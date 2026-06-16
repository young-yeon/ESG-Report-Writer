import { TOO_MUCH_INPUT_MESSAGE } from "./config.js";

export async function callChatCompletion({
  baseUrl,
  model,
  apiKey,
  systemPrompt,
  userContent,
  variantGuide = "",
  temperature = 0.55,
  topP = 0.9,
  maxTokens = 6000
}) {
  const endpoint = getChatEndpoint(baseUrl);
  const headers = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(userContent, variantGuide) }
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens
      })
    });
  } catch (error) {
    throw createDiagnosticError("LLM 서버에 연결할 수 없습니다.", [
      { label: "호출 엔드포인트", value: endpoint },
      { label: "브라우저 오류", value: error.message || String(error) }
    ]);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw createDiagnosticError(extractErrorMessage(responseText, response.status), [
      { label: "HTTP 상태", value: String(response.status) },
      { label: "호출 엔드포인트", value: endpoint },
      { label: "응답 길이", value: `${responseText.length}자` },
      { label: "응답 미리보기", value: previewText(responseText) || "빈 응답" }
    ]);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw createDiagnosticError("LLM 서버 응답을 JSON으로 해석할 수 없습니다.", [
      { label: "HTTP 상태", value: String(response.status) },
      { label: "호출 엔드포인트", value: endpoint },
      { label: "응답 길이", value: `${responseText.length}자` },
      { label: "응답 미리보기", value: previewText(responseText) || "빈 응답" }
    ]);
  }

  const content = extractMessageContent(data);
  if (!content) {
    throw createDiagnosticError("LLM 응답에서 본문을 찾을 수 없습니다.", [
      { label: "HTTP 상태", value: String(response.status) },
      { label: "호출 엔드포인트", value: endpoint },
      { label: "응답 구조", value: summarizeChatResponse(data) },
      { label: "응답 미리보기", value: previewJson(data) }
    ]);
  }
  return content;
}

function buildUserMessage(userContent, variantGuide) {
  const guide = String(variantGuide || "").trim();
  if (!guide) {
    return userContent;
  }
  return `${userContent}\n\n[출력 버전 지침]\n${guide}`;
}

export function normalizeGenerationError(error) {
  if (isContextLimitError(error)) {
    return TOO_MUCH_INPUT_MESSAGE;
  }
  return error?.message || String(error);
}

export function getErrorDiagnostics(error) {
  return Array.isArray(error?.diagnostics) ? error.diagnostics : [];
}

export function isContextLimitError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return [
    "context",
    "token",
    "maximum context",
    "context length",
    "maximum length",
    "prompt length",
    "input length",
    "sequence length",
    "too many tokens",
    "payload too large",
    "request entity too large",
    "out of memory",
    "oom",
    "cuda out of memory",
    "memory",
    "413",
    "컨텍스트",
    "토큰",
    "메모리"
  ].some((pattern) => message.includes(pattern));
}

function getChatEndpoint(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function extractErrorMessage(responseText, status) {
  try {
    const data = JSON.parse(responseText);
    const detail = data?.error?.message || data?.detail || data?.message;
    if (typeof detail === "string") {
      return `LLM 서버 오류(${status}): ${detail}`;
    }
    return `LLM 서버 오류(${status}): ${JSON.stringify(detail || data)}`;
  } catch {
    return `LLM 서버 오류(${status}): ${responseText.slice(0, 800)}`;
  }
}

function extractMessageContent(data) {
  const choice = data?.choices?.[0];
  const messageContent = choice?.message?.content;

  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return part?.text || part?.content || "";
      })
      .join("")
      .trim();
  }

  if (typeof choice?.text === "string") {
    return choice.text;
  }

  return "";
}

function summarizeChatResponse(data) {
  const choice = data?.choices?.[0];
  const message = choice?.message || {};
  const keys = {
    rootKeys: Object.keys(data || {}),
    choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
    firstChoiceKeys: Object.keys(choice || {}),
    messageKeys: Object.keys(message || {}),
    finishReason: choice?.finish_reason || "",
    hasToolCalls: Array.isArray(message?.tool_calls) && message.tool_calls.length > 0,
    hasReasoningContent: typeof message?.reasoning_content === "string" && message.reasoning_content.length > 0
  };
  return JSON.stringify(keys, null, 2);
}

function createDiagnosticError(message, diagnostics) {
  const error = new Error(message);
  error.diagnostics = diagnostics;
  return error;
}

function previewJson(value, limit = 1200) {
  try {
    return previewText(JSON.stringify(value, null, 2), limit);
  } catch {
    return "";
  }
}

function previewText(value, limit = 1200) {
  const text = String(value || "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n... (${text.length - limit}자 더 있음)`;
}
