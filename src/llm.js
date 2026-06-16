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

  const response = await fetch(endpoint, {
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

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(extractErrorMessage(responseText, response.status));
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("LLM 서버 응답을 JSON으로 해석할 수 없습니다.");
  }

  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
  if (!content) {
    throw new Error("LLM 응답에서 본문을 찾을 수 없습니다.");
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
