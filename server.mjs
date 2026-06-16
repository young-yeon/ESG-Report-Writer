import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const env = readEnvFile(join(rootDir, ".env"));
const dataDir = join(rootDir, "data");
const promptStorePath = join(dataDir, "prompts.json");

const host = process.env.APP_HOST || env.APP_HOST || "127.0.0.1";
const port = Number(process.env.APP_PORT || env.APP_PORT || 5173);
const accessPassword = process.env.APP_ACCESS_PASSWORD || env.APP_ACCESS_PASSWORD || "admin";
const sessionSecret = process.env.APP_SESSION_SECRET || env.APP_SESSION_SECRET || accessPassword;
const sessionMaxAgeSeconds = Number(process.env.APP_SESSION_MAX_AGE_SECONDS || env.APP_SESSION_MAX_AGE_SECONDS || 28800);

const config = {
  baseUrl:
    process.env.OPENAI_COMPATIBLE_BASE_URL ||
    env.OPENAI_COMPATIBLE_BASE_URL ||
    "http://127.0.0.1:30000/v1",
  apiKey:
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    env.OPENAI_COMPATIBLE_API_KEY ||
    "",
  model: process.env.LLM_MODEL || env.LLM_MODEL || "Qwen3.6",
  thinkingMode: readThinkingMode(process.env.LLM_THINKING_MODE || env.LLM_THINKING_MODE),
  maxTotalFileChars: readPositiveNumber(
    process.env.MAX_TOTAL_FILE_CHARS || env.MAX_TOTAL_FILE_CHARS,
    180000
  )
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const allowedPaths = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/src/api.js",
  "/src/app.js",
  "/src/classification.js",
  "/src/config.js",
  "/src/file-extractors.js",
  "/src/llm.js",
  "/src/report-renderer.js",
  "/src/utils.js",
  "/runtime-config.js",
  "/vendor/pdfjs/pdf.min.js",
  "/vendor/pdfjs/pdf.worker.min.js"
]);

const defaultPromptStore = {
  systemPrompts: [
    {
      id: "system-single-column-esg",
      name: "자료 기반 단일 컬럼",
      content: `당신은 ESG 보고서 편집자입니다.
사용자가 제공한 자료에서 하나의 보고서 컬럼으로 만들 수 있는 단일 주제를 선별하고, 지속가능경영 보고서에 바로 배치할 수 있는 초안을 작성합니다.
보고서 분야는 Business, Environmental, Social, Governance 중 하나로 구분합니다.
첨부 자료는 보도자료, 뉴스, 공시, 사내 설명자료, 표 형태 자료일 수 있으며, 원문을 그대로 요약하지 말고 보고서 문체로 재구성합니다.
첨부 자료에 있는 사실, 수치, 기간, 기관명, 활동명만 근거로 사용하고, 근거가 부족한 내용은 "추가 확인 필요"로 표시합니다.
자료에 여러 이슈가 섞여 있으면 사용자의 요청을 우선하고, 요청이 모호하면 단일 컬럼으로 가장 완성도가 높은 하나의 주제만 선택합니다.
전체 보고서 개요가 아니라 하나의 독립적인 보고서 컬럼 완성도를 우선합니다.
회사 로고, 외부 이미지, 실제 사진은 넣지 말고 회사명이나 기관명은 텍스트로만 표기합니다.
전체 분량은 본문 텍스트와 핵심 근거 설명을 중심으로 하고, 도식, 표, 추진체계, KPI, 인포그래픽은 내용을 보조하는 하단 요소로 구성합니다.`,
      updatedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  requestPrompts: [
    {
      id: "request-single-column-esg",
      name: "단일 컬럼 생성",
      content: "업로드한 보도자료나 참고 자료를 바탕으로 지속가능경영 보고서의 단일 컬럼 초안을 작성해줘. 제목, 본문 중심 설명, 핵심 근거, 하단 도식/표/인포그래픽 설계까지 구성하되, 시각 요소는 자료 기반 메시지를 보조하도록 만들어줘.",
      updatedAt: "2026-06-16T00:00:00.000Z"
    }
  ]
};

const server = createServer(async (req, res) => {
  req.on("error", () => {});
  res.on("error", () => {});

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    if (!allowedPaths.has(pathname)) {
      send(res, 404, "text/plain; charset=utf-8", "Not Found");
      return;
    }

    if (pathname === "/runtime-config.js") {
      const authenticated = isAuthenticated(req);
      const body = `window.ESG_APP_CONFIG = ${JSON.stringify(authenticated ? config : {}, null, 2)};\n`;
      send(res, 200, "text/javascript; charset=utf-8", body);
      return;
    }

    const filePath = safeStaticPath(pathname === "/" ? "/index.html" : pathname);
    if (!filePath) {
      send(res, 403, "text/plain; charset=utf-8", "Forbidden");
      return;
    }

    const body = await readFile(filePath);
    send(res, 200, mimeTypes[extname(filePath)] || "application/octet-stream", body);
  } catch (error) {
    sendJson(res, 500, { error: `Server error: ${error.message}` });
  }
});

server.on("clientError", (_error, socket) => {
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

server.listen(port, host, async () => {
  await ensurePromptStore();
  if (accessPassword === "admin") {
    console.warn("APP_ACCESS_PASSWORD is using the default value. Change it in .env before sharing this server.");
  }
  console.log(`ESG Report Writer running at http://${host}:${port}`);
});

async function handleApi(req, res, pathname) {
  if (pathname === "/api/session" && req.method === "GET") {
    sendJson(res, 200, { authenticated: isAuthenticated(req) });
    return;
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (body.password !== accessPassword) {
      sendJson(res, 401, { error: "비밀번호가 올바르지 않습니다." });
      return;
    }

    const token = createSessionToken();
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": `esg_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}`
    });
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": "esg_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    return;
  }

  if (!isAuthenticated(req)) {
    sendJson(res, 401, { error: "인증이 필요합니다." });
    return;
  }

  if (pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, config);
    return;
  }

  if (pathname === "/api/prompts" && req.method === "GET") {
    sendJson(res, 200, await readPromptStore());
    return;
  }

  if (pathname === "/api/prompts" && req.method === "PUT") {
    const body = await readJsonBody(req, 1024 * 1024);
    const store = normalizePromptStore(body);
    await writePromptStore(store);
    sendJson(res, 200, store);
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}

async function ensurePromptStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(promptStorePath)) {
    await writePromptStore(defaultPromptStore);
  }
}

async function readPromptStore() {
  await ensurePromptStore();
  try {
    const raw = await readFile(promptStorePath, "utf8");
    return normalizePromptStore(JSON.parse(raw));
  } catch {
    await writePromptStore(defaultPromptStore);
    return normalizePromptStore(defaultPromptStore);
  }
}

async function writePromptStore(store) {
  await mkdir(dataDir, { recursive: true });
  const normalized = normalizePromptStore(store);
  const tempPath = `${promptStorePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempPath, promptStorePath);
}

function normalizePromptStore(store) {
  return {
    systemPrompts: normalizePromptList(store?.systemPrompts),
    requestPrompts: normalizePromptList(store?.requestPrompts)
  };
}

function normalizePromptList(prompts) {
  const list = Array.isArray(prompts) ? prompts : [];
  return list
    .map((prompt) => ({
      id: String(prompt?.id || "").trim() || randomId(),
      name: String(prompt?.name || "이름 없는 프롬프트").trim(),
      content: String(prompt?.content || "").trim(),
      updatedAt: String(prompt?.updatedAt || new Date().toISOString())
    }))
    .filter((prompt) => prompt.content);
}

async function readJsonBody(req, limit = 128 * 1024) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) {
      throw new Error("Request body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function createSessionToken() {
  const expiresAt = Date.now() + sessionMaxAgeSeconds * 1000;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie || "").esg_session;
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return false;
  }

  const payload = `${parts[0]}.${parts[1]}`;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  return safeEqual(parts[2], sign(payload));
}

function sign(value) {
  return toBase64Url(createHmac("sha256", sessionSecret).update(value).digest("base64"));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}

function toBase64Url(value) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const result = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function readThinkingMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["auto", "disabled", "soft", "server", "enabled"].includes(normalized)
    ? normalized
    : "auto";
}

function safeStaticPath(pathname) {
  const relativePath = pathname.replace(/^\/+/, "");
  const fullPath = normalize(join(rootDir, relativePath));
  if (!fullPath.startsWith(rootDir)) {
    return null;
  }
  return fullPath;
}

function randomId() {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sendJson(res, status, body, extraHeaders = {}) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(body), extraHeaders);
}

function send(res, status, contentType, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  res.end(body);
}
