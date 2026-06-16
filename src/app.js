import { apiGet, apiPost, apiPut } from "./api.js";
import { classifyReportField } from "./classification.js";
import {
  COMMON_HTML_TEMPLATE_PROMPT,
  DEFAULT_REQUEST_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  HTML_RENDER_PROMPT,
  MANDATORY_SYSTEM_APPENDIX,
  MAX_TOTAL_FILE_CHARS,
  REPORT_PLAN_PROMPT,
  STORAGE_KEYS,
  TOO_MUCH_INPUT_MESSAGE
} from "./config.js";
import { readUpload, isSupportedFile } from "./file-extractors.js";
import {
  callChatCompletion,
  getErrorDiagnostics,
  isContextLimitError,
  normalizeGenerationError
} from "./llm.js";
import { buildPrintableDocument, buildReportDocument } from "./report-renderer.js";
import { createId, escapeHtml, formatBytes, formatNumber, getFileExtension } from "./utils.js";

try {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== "function") {
    globalThis.crypto.randomUUID = () => createId("uuid");
  }
} catch {
  // Older browsers may expose a non-extensible crypto object. The app uses createId directly.
}

const elements = {
  appShell: document.querySelector("#appShell"),
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  accessPasswordInput: document.querySelector("#accessPasswordInput"),
  authMessage: document.querySelector("#authMessage"),
  classificationBadge: document.querySelector("#classificationBadge"),
  systemPromptSection: document.querySelector("#systemPromptSection"),
  promptNameInput: document.querySelector("#promptNameInput"),
  savedPromptSelect: document.querySelector("#savedPromptSelect"),
  systemPromptInput: document.querySelector("#systemPromptInput"),
  systemPromptFullscreenButton: document.querySelector("#systemPromptFullscreenButton"),
  savePromptButton: document.querySelector("#savePromptButton"),
  deletePromptButton: document.querySelector("#deletePromptButton"),
  resetPromptButton: document.querySelector("#resetPromptButton"),
  requestPromptSection: document.querySelector("#requestPromptSection"),
  requestPromptNameInput: document.querySelector("#requestPromptNameInput"),
  savedRequestPromptSelect: document.querySelector("#savedRequestPromptSelect"),
  requestPromptFullscreenButton: document.querySelector("#requestPromptFullscreenButton"),
  saveRequestPromptButton: document.querySelector("#saveRequestPromptButton"),
  deleteRequestPromptButton: document.querySelector("#deleteRequestPromptButton"),
  resetRequestPromptButton: document.querySelector("#resetRequestPromptButton"),
  fileInput: document.querySelector("#fileInput"),
  fileList: document.querySelector("#fileList"),
  requestInput: document.querySelector("#requestInput"),
  generateButton: document.querySelector("#generateButton"),
  clearButton: document.querySelector("#clearButton"),
  generationMessage: document.querySelector("#generationMessage"),
  results: {
    A: getResultElements("resultA"),
    B: getResultElements("resultB")
  }
};

let uploadedFiles = [];
let activeResults = {
  A: null,
  B: null
};
let appConfig = {};
let promptStore = {
  systemPrompts: [],
  requestPrompts: []
};

init();

async function init() {
  bindUiEvents();
  renderEmptyResults();
  updateClassificationPreview();

  try {
    const session = await apiGet("/api/session");
    if (session.authenticated) {
      await unlockApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin("서버 연결을 확인해주세요.");
  }
}

function bindUiEvents() {
  elements.authForm.addEventListener("submit", handleLogin);
  elements.savePromptButton.addEventListener("click", () => saveCurrentPrompt().catch(showActionError));
  elements.deletePromptButton.addEventListener("click", () => deleteSelectedPrompt().catch(showActionError));
  elements.resetPromptButton.addEventListener("click", resetPrompt);
  elements.systemPromptFullscreenButton.addEventListener("click", () => togglePromptFullscreen("system").catch(showActionError));
  elements.savedPromptSelect.addEventListener("change", loadSelectedPrompt);
  elements.saveRequestPromptButton.addEventListener("click", () => saveCurrentRequestPrompt().catch(showActionError));
  elements.deleteRequestPromptButton.addEventListener("click", () => deleteSelectedRequestPrompt().catch(showActionError));
  elements.resetRequestPromptButton.addEventListener("click", resetRequestPrompt);
  elements.requestPromptFullscreenButton.addEventListener("click", () => togglePromptFullscreen("request").catch(showActionError));
  elements.savedRequestPromptSelect.addEventListener("change", loadSelectedRequestPrompt);
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.requestInput.addEventListener("input", updateClassificationPreview);
  elements.generateButton.addEventListener("click", generateReports);
  elements.clearButton.addEventListener("click", clearDraft);

  for (const key of ["A", "B"]) {
    elements.results[key].pdfButton.addEventListener("click", () => printResult(key));
    elements.results[key].rerenderButton.addEventListener("click", () => rerenderResult(key).catch(showActionError));
    elements.results[key].fullscreenButton.addEventListener("click", () => toggleFullscreen(key));
  }
  document.addEventListener("fullscreenchange", handleFullscreenChange);
}

function getResultElements(id) {
  const root = document.querySelector(`#${id}`);
  return {
    root,
    badge: root.querySelector(".status-badge"),
    frame: root.querySelector(".result-frame"),
    pdfButton: root.querySelector(".pdf-button"),
    rerenderButton: root.querySelector(".rerender-button"),
    fullscreenButton: root.querySelector(".fullscreen-button")
  };
}

async function handleLogin(event) {
  event.preventDefault();
  const password = elements.accessPasswordInput.value;
  if (!password) {
    showLogin("비밀번호를 입력해주세요.");
    return;
  }

  try {
    await apiPost("/api/login", { password });
    elements.accessPasswordInput.value = "";
    await unlockApp();
  } catch (error) {
    showLogin(error.message || "비밀번호가 올바르지 않습니다.");
  }
}

async function unlockApp() {
  appConfig = await apiGet("/api/config");
  promptStore = await apiGet("/api/prompts");

  renderSavedPromptOptions();
  loadSelectedPrompt();
  renderSavedRequestPromptOptions();
  loadSelectedRequestPrompt();
  elements.authOverlay.hidden = true;
  elements.appShell.classList.remove("is-locked");
}

function showLogin(message = "") {
  elements.authOverlay.hidden = false;
  elements.appShell.classList.add("is-locked");
  elements.authMessage.textContent = message;
  elements.accessPasswordInput.focus();
}

function getPrompts() {
  return promptStore.systemPrompts || [];
}

async function setPrompts(prompts) {
  promptStore.systemPrompts = prompts;
  promptStore = await apiPut("/api/prompts", promptStore);
}

function renderSavedPromptOptions() {
  const prompts = getPrompts();
  const selectedId = localStorage.getItem(STORAGE_KEYS.selectedPromptId) || prompts[0]?.id || "";

  elements.savedPromptSelect.innerHTML = "";
  for (const prompt of prompts) {
    const option = document.createElement("option");
    option.value = prompt.id;
    option.textContent = prompt.name;
    elements.savedPromptSelect.append(option);
  }
  elements.savedPromptSelect.value = selectedId;
}

function loadSelectedPrompt() {
  const prompts = getPrompts();
  const selectedPrompt = prompts.find((prompt) => prompt.id === elements.savedPromptSelect.value) || prompts[0];
  if (!selectedPrompt) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.selectedPromptId, selectedPrompt.id);
  elements.promptNameInput.value = selectedPrompt.name;
  elements.systemPromptInput.value = selectedPrompt.content;
}

async function saveCurrentPrompt() {
  const name = elements.promptNameInput.value.trim() || "이름 없는 프롬프트";
  const content = elements.systemPromptInput.value.trim();
  if (!content) {
    setMessage("시스템 프롬프트 내용을 입력해주세요.", "error");
    return;
  }

  const prompts = getPrompts();
  const selectedId = elements.savedPromptSelect.value;
  const existing = prompts.find((prompt) => prompt.id === selectedId);

  if (existing) {
    existing.name = name;
    existing.content = content;
    existing.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.selectedPromptId, existing.id);
  } else {
    const nextPrompt = {
      id: createId("system"),
      name,
      content,
      updatedAt: new Date().toISOString()
    };
    prompts.push(nextPrompt);
    localStorage.setItem(STORAGE_KEYS.selectedPromptId, nextPrompt.id);
  }

  await setPrompts(prompts);
  renderSavedPromptOptions();
  loadSelectedPrompt();
  setMessage("시스템 프롬프트를 저장했습니다.", "done");
}

async function deleteSelectedPrompt() {
  const prompts = getPrompts();
  if (prompts.length <= 1) {
    setMessage("최소 1개의 시스템 프롬프트는 남겨두어야 합니다.", "error");
    return;
  }

  const selectedId = elements.savedPromptSelect.value;
  const nextPrompts = prompts.filter((prompt) => prompt.id !== selectedId);
  await setPrompts(nextPrompts);
  localStorage.setItem(STORAGE_KEYS.selectedPromptId, nextPrompts[0].id);
  renderSavedPromptOptions();
  loadSelectedPrompt();
  setMessage("선택한 시스템 프롬프트를 삭제했습니다.", "done");
}

function resetPrompt() {
  elements.promptNameInput.value = "자료 기반 단일 컬럼";
  elements.systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  setMessage("기본 프롬프트를 불러왔습니다. 저장하면 현재 슬롯에 반영됩니다.", "done");
}

function getRequestPrompts() {
  return promptStore.requestPrompts || [];
}

async function setRequestPrompts(prompts) {
  promptStore.requestPrompts = prompts;
  promptStore = await apiPut("/api/prompts", promptStore);
}

function renderSavedRequestPromptOptions() {
  const prompts = getRequestPrompts();
  const selectedId = localStorage.getItem(STORAGE_KEYS.selectedRequestPromptId) || prompts[0]?.id || "";

  elements.savedRequestPromptSelect.innerHTML = "";
  for (const prompt of prompts) {
    const option = document.createElement("option");
    option.value = prompt.id;
    option.textContent = prompt.name;
    elements.savedRequestPromptSelect.append(option);
  }
  elements.savedRequestPromptSelect.value = selectedId;
}

function loadSelectedRequestPrompt() {
  const prompts = getRequestPrompts();
  const selectedPrompt = prompts.find((prompt) => prompt.id === elements.savedRequestPromptSelect.value) || prompts[0];
  if (!selectedPrompt) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.selectedRequestPromptId, selectedPrompt.id);
  elements.requestPromptNameInput.value = selectedPrompt.name;
  elements.requestInput.value = selectedPrompt.content;
  updateClassificationPreview();
}

async function saveCurrentRequestPrompt() {
  const name = elements.requestPromptNameInput.value.trim() || "이름 없는 요청";
  const content = elements.requestInput.value.trim();
  if (!content) {
    setMessage("작성 요청을 입력해주세요.", "error");
    return;
  }

  const prompts = getRequestPrompts();
  const selectedId = elements.savedRequestPromptSelect.value;
  const existing = prompts.find((prompt) => prompt.id === selectedId);

  if (existing) {
    existing.name = name;
    existing.content = content;
    existing.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.selectedRequestPromptId, existing.id);
  } else {
    const nextPrompt = {
      id: createId("request"),
      name,
      content,
      updatedAt: new Date().toISOString()
    };
    prompts.push(nextPrompt);
    localStorage.setItem(STORAGE_KEYS.selectedRequestPromptId, nextPrompt.id);
  }

  await setRequestPrompts(prompts);
  renderSavedRequestPromptOptions();
  loadSelectedRequestPrompt();
  setMessage("작성 요청을 저장했습니다.", "done");
}

async function deleteSelectedRequestPrompt() {
  const prompts = getRequestPrompts();
  if (prompts.length <= 1) {
    setMessage("최소 1개의 작성 요청은 남겨두어야 합니다.", "error");
    return;
  }

  const selectedId = elements.savedRequestPromptSelect.value;
  const nextPrompts = prompts.filter((prompt) => prompt.id !== selectedId);
  await setRequestPrompts(nextPrompts);
  localStorage.setItem(STORAGE_KEYS.selectedRequestPromptId, nextPrompts[0].id);
  renderSavedRequestPromptOptions();
  loadSelectedRequestPrompt();
  setMessage("작성 요청을 삭제했습니다.", "done");
}

function resetRequestPrompt() {
  elements.requestPromptNameInput.value = "단일 컬럼 생성";
  elements.requestInput.value = DEFAULT_REQUEST_PROMPT;
  updateClassificationPreview();
  setMessage("기본 작성 요청을 불러왔습니다.", "done");
}

async function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  uploadedFiles = [];
  elements.fileList.innerHTML = "";

  if (files.length === 0) {
    updateClassificationPreview();
    return;
  }

  const supportedFiles = files.filter(isSupportedFile);
  const rejectedCount = files.length - supportedFiles.length;
  if (supportedFiles.length === 0) {
    updateClassificationPreview();
    setMessage("지원 형식: PDF, XLSX, CSV, TXT", "error");
    return;
  }

  let totalChars = 0;
  elements.fileInput.disabled = true;
  elements.generateButton.disabled = true;
  setMessage(`첨부 자료 텍스트 추출 중 (0/${supportedFiles.length})`, "loading");
  renderExtractionProgress(supportedFiles, 0);
  await waitForUiUpdate();

  try {
    const maxTotalFileChars = getMaxTotalFileChars();
    for (let index = 0; index < supportedFiles.length; index += 1) {
      const file = supportedFiles[index];
      renderExtractionProgress(supportedFiles, index);
      setMessage(`첨부 자료 텍스트 추출 중 (${index + 1}/${supportedFiles.length})`, "loading");
      await waitForUiUpdate();

      const fileInfo = await readUpload(file, maxTotalFileChars - totalChars);
      totalChars += fileInfo.content.length;
      uploadedFiles.push(fileInfo);
      renderExtractionProgress(supportedFiles, index + 1);
    }
  } finally {
    elements.fileInput.disabled = false;
    elements.generateButton.disabled = false;
  }

  renderFileList();
  updateClassificationPreview();
  if (rejectedCount > 0) {
    setMessage("지원 형식: PDF, XLSX, CSV, TXT", "error");
  } else if (uploadedFiles.some((file) => file.warning === TOO_MUCH_INPUT_MESSAGE)) {
    setMessage(TOO_MUCH_INPUT_MESSAGE, "error");
  } else {
    setMessage(`첨부 자료 ${uploadedFiles.length}개 추출 완료`, "done");
  }
}

function renderFileList() {
  elements.fileList.innerHTML = "";
  if (uploadedFiles.length === 0) {
    return;
  }

  for (const file of uploadedFiles) {
    elements.fileList.append(createFileItem(file));
  }
}

function renderExtractionProgress(files, currentIndex) {
  elements.fileList.innerHTML = "";

  files.forEach((file, index) => {
    if (index < uploadedFiles.length) {
      elements.fileList.append(createFileItem(uploadedFiles[index]));
      return;
    }

    const item = createFileShell(file.name);
    if (index === currentIndex) {
      item.classList.add("is-loading");
    }

    const meta = document.createElement("div");
    meta.className = index === currentIndex ? "file-meta file-progress" : "file-meta";
    meta.textContent = `${getDisplayFileType(file.name)} · ${formatBytes(file.size)} · ${index === currentIndex ? "텍스트 추출 중" : "대기"}`;
    item.append(meta);
    elements.fileList.append(item);
  });
}

function createFileItem(file) {
  const item = createFileShell(file.name);

  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.textContent = `${file.type} · ${formatBytes(file.size)} · ${formatNumber(file.content.length)}자`;

  item.append(meta);
  if (file.warning) {
    const warning = document.createElement("div");
    warning.className = "file-meta file-warning";
    warning.textContent = file.warning;
    item.append(warning);
  }
  return item;
}

function createFileShell(nameText) {
  const item = document.createElement("div");
  item.className = "file-item";

  const name = document.createElement("div");
  name.className = "file-name";
  name.textContent = nameText;
  item.append(name);
  return item;
}

function getDisplayFileType(fileName) {
  return getFileExtension(fileName).toUpperCase() || "FILE";
}

function getMaxTotalFileChars() {
  const configured = Number(appConfig.maxTotalFileChars);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : MAX_TOTAL_FILE_CHARS;
}

function waitForUiUpdate() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function generateReports() {
  const requestText = elements.requestInput.value.trim();
  const systemPrompt = elements.systemPromptInput.value.trim();
  const baseUrl = appConfig.baseUrl;
  const model = appConfig.model;
  const classification = classifyReportField(buildClassificationText(requestText));

  if (!baseUrl || !model) {
    setMessage("관리자 설정을 확인해주세요.", "error");
    return;
  }

  if (!systemPrompt) {
    setMessage("시스템 프롬프트를 입력해주세요.", "error");
    return;
  }

  if (!requestText) {
    setMessage("작성 요청을 입력해주세요.", "error");
    return;
  }

  updateClassificationBadge(classification);
  setMessage("내용 설계 중", "loading");
  prepareResultForLoading("A", "설계 중");
  prepareResultForLoading("B", "설계 중");
  elements.generateButton.disabled = true;

  const planSystemPrompt = `${systemPrompt}\n\n${REPORT_PLAN_PROMPT}`;
  const userContent = buildUserContent(requestText, classification);
  const planVariants = {
    A: "A안입니다. 자료의 핵심 메시지를 가장 안정적으로 전달하는 보고서 설계 JSON을 작성하세요. visualSpec.type은 근거가 가장 충분한 유형을 선택하세요.",
    B: "B안입니다. 같은 자료 범위 안에서 A안과 다른 제목, 강조점, visualSpec.type 또는 도식 구성을 검토해 보고서 설계 JSON을 작성하세요."
  };

  const errors = [];

  try {
    const planResults = await Promise.allSettled([
      generateReportPlan({
        baseUrl,
        model,
        apiKey: appConfig.apiKey,
        systemPrompt: planSystemPrompt,
        userContent,
        variantGuide: planVariants.A,
        classification
      }),
      generateReportPlan({
        baseUrl,
        model,
        apiKey: appConfig.apiKey,
        systemPrompt: planSystemPrompt,
        userContent,
        variantGuide: planVariants.B,
        classification
      })
    ]);

    const renderTargets = [];
    ["A", "B"].forEach((key, index) => {
      const planResult = planResults[index];
      if (planResult.status === "fulfilled") {
        activeResults[key] = {
          plan: planResult.value,
          rawHtml: null,
          printDocument: null
        };
        setResultState(key, "loading", "HTML 구성 중");
        renderTargets.push({ key, plan: planResult.value });
        return;
      }

      errors.push(planResult.reason);
      showGenerationError(key, planResult.reason, { stage: "설계 JSON 생성" });
    });

    if (renderTargets.length > 0) {
      setMessage("HTML 구성 중", "loading");
    }

    const renderResults = await Promise.allSettled(
      renderTargets.map(({ key, plan }) => renderReportHtml({
        baseUrl,
        model,
        apiKey: appConfig.apiKey,
        plan,
        variantGuide: `${key}안 HTML 변환입니다. 설계 JSON의 facts와 visualSpec을 유지하되, 화면이 깨지지 않는 단일 컬럼 HTML로 렌더링하세요.`
      }))
    );

    renderResults.forEach((renderResult, index) => {
      const target = renderTargets[index];
      if (renderResult.status === "fulfilled") {
        applyRenderedResult(target.key, target.plan, renderResult.value);
        return;
      }

      errors.push(renderResult.reason);
      showGenerationError(target.key, renderResult.reason, { plan: target.plan, stage: "HTML 변환" });
    });

    if (errors.some(isContextLimitError)) {
      setMessage(TOO_MUCH_INPUT_MESSAGE, "error");
    } else if (errors.length === 0) {
      setMessage("완료", "done");
    } else if (errors.length === 1) {
      setMessage(`오류: ${shortStatusMessage(normalizeGenerationError(errors[0]))}`, "error");
    } else {
      setMessage(`오류 ${errors.length}건: ${shortStatusMessage(normalizeGenerationError(errors[0]))}`, "error");
    }
  } finally {
    elements.generateButton.disabled = false;
  }
}

async function generateReportPlan({
  baseUrl,
  model,
  apiKey,
  systemPrompt,
  userContent,
  variantGuide,
  classification
}) {
  const rawPlan = await callChatCompletion({
    baseUrl,
    model,
    apiKey,
    systemPrompt,
    userContent,
    variantGuide,
    temperature: 0.35,
    topP: 0.85,
    maxTokens: 4200
  });
  return normalizeReportPlan(parseModelJson(rawPlan), classification);
}

async function renderReportHtml({
  baseUrl,
  model,
  apiKey,
  plan,
  variantGuide
}) {
  return callChatCompletion({
    baseUrl,
    model,
    apiKey,
    systemPrompt: `${MANDATORY_SYSTEM_APPENDIX}\n\n${HTML_RENDER_PROMPT}\n\n${COMMON_HTML_TEMPLATE_PROMPT}`,
    userContent: `[보고서 설계 JSON]\n${JSON.stringify(plan, null, 2)}`,
    variantGuide,
    temperature: 0.5,
    topP: 0.9,
    maxTokens: 6500
  });
}

function parseModelJson(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const candidate = fenced
    ? fenced[1].trim()
    : firstBrace >= 0 && lastBrace > firstBrace
      ? text.slice(firstBrace, lastBrace + 1)
      : text;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    const parseError = new Error("보고서 설계 JSON을 해석할 수 없습니다. 모델 출력이 JSON이 아니거나 중간에 잘렸을 수 있습니다.");
    parseError.diagnostics = [
      { label: "파서 오류", value: error.message },
      { label: "LLM 응답 길이", value: `${text.length}자` },
      { label: "JSON 후보 길이", value: `${candidate.length}자` },
      { label: "LLM 응답 미리보기", value: previewDiagnosticText(text) || "빈 응답" },
      { label: "JSON 후보 미리보기", value: previewDiagnosticText(candidate) || "후보 없음" }
    ];
    throw parseError;
  }
}

function normalizeReportPlan(plan, classification) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("보고서 설계 JSON 형식이 올바르지 않습니다.");
  }

  const normalized = {
    field: String(plan.field || classification.label || ""),
    accent: String(plan.accent || classification.accent || ""),
    topic: String(plan.topic || ""),
    title: String(plan.title || "보고서 컬럼 제목"),
    sourceNote: String(plan.sourceNote || ""),
    lead: String(plan.lead || ""),
    bodyParagraphs: normalizeStringArray(plan.bodyParagraphs),
    evidenceCards: normalizeArray(plan.evidenceCards),
    visualSpec: normalizeVisualSpec(plan.visualSpec),
    tableSpec: normalizeTableSpec(plan.tableSpec),
    uncertainFacts: normalizeStringArray(plan.uncertainFacts),
    renderNotes: normalizeStringArray(plan.renderNotes)
  };

  if (!normalized.bodyParagraphs.length && normalized.lead) {
    normalized.bodyParagraphs = [normalized.lead];
  }
  if (!normalized.visualSpec.type) {
    normalized.visualSpec.type = "initiative_portfolio";
  }
  return normalized;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeVisualSpec(value) {
  const spec = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    type: String(spec.type || ""),
    title: String(spec.title || ""),
    rationale: String(spec.rationale || ""),
    items: normalizeArray(spec.items),
    columns: normalizeStringArray(spec.columns),
    rows: Array.isArray(spec.rows) ? spec.rows : []
  };
}

function normalizeTableSpec(value) {
  const spec = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    title: String(spec.title || ""),
    columns: normalizeStringArray(spec.columns),
    rows: Array.isArray(spec.rows) ? spec.rows : []
  };
}

function applyRenderedResult(key, plan, rawHtml) {
  const printDocument = buildReportDocument(rawHtml);
  activeResults[key] = {
    plan,
    rawHtml,
    printDocument
  };
  elements.results[key].frame.srcdoc = printDocument;
  setResultActions(key, { pdf: true, rerender: true });
  setResultState(key, "done", "완료");
}

function showGenerationError(key, error, options = {}) {
  const errorMessage = normalizeGenerationError(error);
  const errorHtml = buildGenerationErrorHtml({
    key,
    stage: options.stage || "생성",
    message: errorMessage,
    diagnostics: getErrorDiagnostics(error),
    canRerender: Boolean(options.plan)
  });
  activeResults[key] = options.plan
    ? { plan: options.plan, rawHtml: null, printDocument: null }
    : null;
  elements.results[key].frame.srcdoc = buildReportDocument(errorHtml, { alreadySafe: true });
  setResultActions(key, { pdf: false, rerender: Boolean(options.plan) });
  setResultState(key, "error", "오류");
}

function buildGenerationErrorHtml({ key, stage, message, diagnostics, canRerender }) {
  const rows = [
    ["대상", `${key}안`],
    ["실패 단계", stage],
    ["오류", message],
    ["다음 조치", canRerender ? "설계 JSON은 확보되었습니다. 재변환으로 HTML 렌더링만 다시 시도할 수 있습니다." : "설계 JSON 생성 단계에서 실패했습니다. 입력량, 모델 응답 형식, LLM 서버 로그를 확인하세요."]
  ];

  const detailBlocks = diagnostics
    .filter((item) => item?.label || item?.value)
    .map((item) => `
      <section style="margin-top: 14px;">
        <h3 style="margin: 0 0 6px; font-size: 14px; color: #cf8117;">${escapeHtml(item.label || "진단 정보")}</h3>
        <pre style="background: #f5f5f2; border: 1px solid #d7d2ca; border-radius: 6px; color: #222; font-family: Consolas, 'Courier New', monospace; font-size: 11px; line-height: 1.5; margin: 0; max-height: 240px; overflow: auto; padding: 10px; white-space: pre-wrap;">${escapeHtml(item.value || "")}</pre>
      </section>
    `)
    .join("");

  return `
    <section class="report-shell">
      <h1>생성 오류</h1>
      <table>
        <tbody>
          ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}
        </tbody>
      </table>
      ${detailBlocks || "<p>추가 진단 정보가 없습니다.</p>"}
    </section>
  `;
}

function buildUserContent(requestText, classification) {
  const sections = [
    `[보고서 분야]\n${classification.label}`,
    `[권장 HTML 테마]\ndata-accent="${classification.accent}"`,
    `[사용자 작성 요청]\n${requestText}`
  ];

  if (uploadedFiles.length > 0) {
    const fileSections = uploadedFiles.map((file) => {
      const header = `[파일명] ${file.name}\n[크기] ${formatBytes(file.size)}`;
      if (!file.content) {
        return `${header}\n[본문]\n본문 추출 없음. 파일명과 사용자 요청만 참고하세요.`;
      }
      return `${header}\n[본문]\n${file.content}`;
    });
    sections.push(`[첨부 자료]\n${fileSections.join("\n\n---\n\n")}`);
  }

  return sections.join("\n\n");
}

function updateClassificationPreview() {
  const requestText = elements.requestInput.value.trim();
  const classification = classifyReportField(buildClassificationText(requestText));
  updateClassificationBadge(classification);
}

function buildClassificationText(requestText) {
  const fileText = uploadedFiles
    .map((file) => `${file.name}\n${file.content.slice(0, 5000)}`)
    .join("\n");
  return `${requestText}\n${fileText}`;
}

function updateClassificationBadge(classification) {
  elements.classificationBadge.dataset.category = classification.key;
  elements.classificationBadge.textContent = classification.label;
}

async function rerenderResult(key) {
  const result = activeResults[key];
  if (!result?.plan) {
    setMessage("재변환할 설계 내용이 없습니다.", "error");
    return;
  }

  const previousResult = result;
  setMessage(`${key}안 HTML 재변환 중`, "loading");
  setResultState(key, "loading", "재변환 중");
  setResultActions(key, { pdf: false, rerender: false });

  try {
    const rawHtml = await renderReportHtml({
      baseUrl: appConfig.baseUrl,
      model: appConfig.model,
      apiKey: appConfig.apiKey,
      plan: result.plan,
      variantGuide: `${key}안 재변환입니다. 설계 JSON의 내용은 유지하고 HTML 구조, 도식, 표, 인포그래픽 표현만 다시 구성하세요.`
    });
    applyRenderedResult(key, result.plan, rawHtml);
    setMessage(`${key}안 재변환 완료`, "done");
  } catch (error) {
    activeResults[key] = previousResult;
    const hasPreviousHtml = Boolean(previousResult.printDocument);
    setResultActions(key, { pdf: hasPreviousHtml, rerender: true });
    setResultState(key, hasPreviousHtml ? "done" : "error", hasPreviousHtml ? "완료" : "오류");
    setMessage(normalizeGenerationError(error), "error");
  }
}

function printResult(key) {
  const result = activeResults[key];
  if (!result?.printDocument) {
    return;
  }

  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) {
    setMessage("팝업 차단을 해제한 뒤 PDF 다운로드를 다시 눌러주세요.", "error");
    return;
  }

  const printableDocument = buildPrintableDocument(result.printDocument);
  printWindow.document.open();
  printWindow.document.write(printableDocument);
  printWindow.document.close();
  setMessage("인쇄 창을 열었습니다. 대상 프린터를 PDF로 저장으로 선택하세요.", "done");
}

async function toggleFullscreen(key) {
  const root = elements.results[key].root;
  if (!document.fullscreenElement) {
    await root.requestFullscreen();
    return;
  }

  await document.exitFullscreen();
}

async function togglePromptFullscreen(type) {
  const root = type === "system" ? elements.systemPromptSection : elements.requestPromptSection;
  const input = type === "system" ? elements.systemPromptInput : elements.requestInput;

  if (!document.fullscreenElement) {
    await root.requestFullscreen();
    input.focus();
    return;
  }

  if (document.fullscreenElement === root) {
    await document.exitFullscreen();
    return;
  }

  await document.exitFullscreen();
  await root.requestFullscreen();
  input.focus();
}

function handleFullscreenChange() {
  updateFullscreenButtons();
  updatePromptFullscreenButtons();
}

function updateFullscreenButtons() {
  for (const key of ["A", "B"]) {
    const isActive = document.fullscreenElement === elements.results[key].root;
    elements.results[key].fullscreenButton.textContent = isActive ? "닫기" : "전체 화면";
  }
}

function updatePromptFullscreenButtons() {
  const systemActive = document.fullscreenElement === elements.systemPromptSection;
  const requestActive = document.fullscreenElement === elements.requestPromptSection;
  elements.systemPromptFullscreenButton.textContent = systemActive ? "닫기" : "전체 화면";
  elements.requestPromptFullscreenButton.textContent = requestActive ? "닫기" : "전체 화면";
}

function renderEmptyResults() {
  const emptyDocument = buildReportDocument(`
    <section class="report-shell">
      <h1>결과 대기</h1>
      <p>요청을 입력하고 초안 생성을 실행하세요.</p>
      <table>
        <thead><tr><th>항목</th><th>상태</th></tr></thead>
        <tbody>
          <tr><td>HTML</td><td>대기</td></tr>
          <tr><td>PDF</td><td>대기</td></tr>
        </tbody>
      </table>
    </section>
  `, { alreadySafe: true });

  for (const key of ["A", "B"]) {
    elements.results[key].frame.srcdoc = emptyDocument;
  }
}

function clearDraft() {
  elements.requestInput.value = "";
  elements.fileInput.value = "";
  uploadedFiles = [];
  renderFileList();
  updateClassificationPreview();
  activeResults = { A: null, B: null };
  renderEmptyResults();
  setResultState("A", "idle", "대기");
  setResultState("B", "idle", "대기");
  setResultActions("A", { pdf: false, rerender: false });
  setResultActions("B", { pdf: false, rerender: false });
  setMessage("입력 내용을 초기화했습니다.", "done");
}

function prepareResultForLoading(key, label) {
  activeResults[key] = null;
  elements.results[key].frame.srcdoc = buildReportDocument(`
    <section class="report-shell">
      <h1>${escapeHtml(label)}</h1>
      <p>보고서 내용과 시각화 구성을 준비하고 있습니다.</p>
    </section>
  `, { alreadySafe: true });
  setResultActions(key, { pdf: false, rerender: false });
  setResultState(key, "loading", label);
}

function setResultActions(key, { pdf, rerender }) {
  elements.results[key].pdfButton.disabled = !pdf;
  elements.results[key].rerenderButton.disabled = !rerender;
}

function setResultState(key, status, label) {
  const badge = elements.results[key].badge;
  badge.dataset.status = status;
  badge.textContent = label;
}

function setMessage(message, type = "info") {
  elements.generationMessage.textContent = message;
  elements.generationMessage.dataset.type = type;
}

function previewDiagnosticText(value, limit = 1400) {
  const text = String(value || "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n... (${text.length - limit}자 더 있음)`;
}

function shortStatusMessage(message, limit = 90) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

function showActionError(error) {
  if (error.message.includes("인증")) {
    showLogin("다시 로그인해주세요.");
    return;
  }
  setMessage(error.message || "처리 중 오류가 발생했습니다.", "error");
}
