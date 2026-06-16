import {
  MAX_FILE_CHARS,
  PDFJS_SCRIPT_SRC,
  PDFJS_WORKER_SRC,
  SUPPORTED_FILE_EXTENSIONS,
  TEXT_FILE_EXTENSIONS,
  TOO_MUCH_INPUT_MESSAGE
} from "./config.js";
import { decodeXml, getFileExtension } from "./utils.js";

let pdfJsLoadPromise = null;

export async function readUpload(file, remainingChars) {
  const extension = getFileExtension(file.name);
  if (remainingChars <= 0) {
    return {
      name: file.name,
      size: file.size,
      type: extension.toUpperCase(),
      content: "",
      warning: TOO_MUCH_INPUT_MESSAGE
    };
  }

  try {
    const extracted = await extractFileText(file, extension);
    const limited = limitText(extracted.text, Math.min(MAX_FILE_CHARS, remainingChars));

    return {
      name: file.name,
      size: file.size,
      type: extension.toUpperCase(),
      content: limited.text,
      warning: extracted.warning || limited.warning
    };
  } catch (error) {
    return {
      name: file.name,
      size: file.size,
      type: extension.toUpperCase(),
      content: "",
      warning: error.message || "텍스트 추출 실패"
    };
  }
}

export function isSupportedFile(file) {
  return SUPPORTED_FILE_EXTENSIONS.has(getFileExtension(file.name));
}

async function extractFileText(file, extension) {
  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    return { text: await file.text(), warning: "" };
  }
  if (extension === "pdf") {
    return extractPdfText(file);
  }
  if (extension === "xlsx") {
    return extractXlsxText(file);
  }
  throw new Error("지원하지 않는 파일입니다.");
}

async function extractPdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfJsResult = await extractPdfTextWithPdfJs(bytes);
  if (pdfJsResult.text) {
    return pdfJsResult;
  }

  const fallbackText = await extractFallbackPdfText(bytes);
  if (fallbackText) {
    return {
      text: fallbackText,
      warning: "PDF 표준 텍스트 추출 결과를 사용했습니다."
    };
  }

  return {
    text: "",
    warning: pdfJsResult.warning || "PDF 텍스트 없음"
  };
}

async function extractPdfTextWithPdfJs(bytes) {
  let loadingTask = null;
  let pdf = null;

  try {
    const pdfjsLib = await loadPdfJs();
    loadingTask = pdfjsLib.getDocument({
      data: bytes,
      disableFontFace: true,
      isEvalSupported: false,
      stopAtErrors: false
    });
    pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      let page = null;
      try {
        page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        const pageText = buildPdfPageText(textContent.items);
        if (pageText) {
          pages.push(`[Page ${pageNumber}]\n${pageText}`);
        }
      } finally {
        if (page) {
          page.cleanup();
        }
      }
    }

    const text = cleanupExtractedText(pages.join("\n\n"));
    return {
      text,
      warning: text ? "" : "PDF 텍스트 없음"
    };
  } catch (error) {
    console.warn("PDF.js extraction failed.", error);
    return {
      text: "",
      warning: "PDF 텍스트 추출 실패"
    };
  } finally {
    if (pdf) {
      await pdf.destroy().catch(() => {});
    } else if (loadingTask && typeof loadingTask.destroy === "function") {
      await loadingTask.destroy().catch(() => {});
    }
  }
}

async function extractFallbackPdfText(bytes) {
  const rawText = decodeLatin1(bytes);
  const streamTexts = await extractPdfContentStreams(bytes, rawText);
  const candidates = streamTexts.length > 0 ? streamTexts : [rawText];
  const text = cleanupExtractedText(dedupeTextLines(
    candidates.flatMap((candidate) => extractPdfTextObjects(candidate))
  ).join("\n"));

  return isLikelyUsefulPdfText(text) ? text : "";
}

function buildPdfPageText(items) {
  const lines = [];
  let line = "";
  let lastY = null;

  for (const item of items || []) {
    const value = normalizePdfTextItem(item?.str);
    if (!value) {
      continue;
    }

    const y = getPdfTextItemY(item);
    if (line && shouldStartPdfLine(lastY, y)) {
      lines.push(line.trim());
      line = value;
    } else {
      line = line ? `${line} ${value}` : value;
    }

    if (Number.isFinite(y)) {
      lastY = y;
    }
  }

  if (line) {
    lines.push(line.trim());
  }

  return cleanupExtractedText(lines.join("\n"));
}

function normalizePdfTextItem(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getPdfTextItemY(item) {
  const transform = item?.transform;
  return Array.isArray(transform) && Number.isFinite(transform[5]) ? transform[5] : null;
}

function shouldStartPdfLine(lastY, currentY) {
  return Number.isFinite(lastY) && Number.isFinite(currentY) && Math.abs(lastY - currentY) > 4;
}

function isLikelyUsefulPdfText(text) {
  const cleaned = cleanupExtractedText(text);
  const visible = cleaned.replace(/\s+/g, "");
  if (visible.length < 8) {
    return false;
  }

  const usefulChars = visible.match(/[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/g) || [];
  return usefulChars.length / visible.length >= 0.35;
}

async function loadPdfJs() {
  if (globalThis.pdfjsLib) {
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    return globalThis.pdfjsLib;
  }

  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = loadScript(PDFJS_SCRIPT_SRC).then(() => {
      if (!globalThis.pdfjsLib) {
        throw new Error("PDF.js 로드 실패");
      }
      globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      return globalThis.pdfjsLib;
    });
  }

  return pdfJsLoadPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src} 로드 실패`));
    document.head.append(script);
  });
}

async function extractPdfContentStreams(bytes, pdfText) {
  const streams = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match;

  while ((match = streamPattern.exec(pdfText)) !== null) {
    const dictionaryText = match[1];
    const rawStreamStart = match.index + match[0].indexOf(match[2]);
    const rawStreamEnd = rawStreamStart + match[2].length;
    const rawBytes = bytes.slice(rawStreamStart, rawStreamEnd);
    const decoded = await decodePdfStream(rawBytes, dictionaryText);
    if (decoded) {
      streams.push(decoded);
    }
  }

  return streams;
}

async function decodePdfStream(rawStream, dictionaryText) {
  if (!/\/FlateDecode\b/.test(dictionaryText)) {
    return decodeLatin1(rawStream);
  }

  const inflated = await inflateBytes(rawStream, ["deflate", "deflate-raw"]);
  return inflated ? decodeLatin1(inflated) : "";
}

function extractPdfTextObjects(text) {
  return [
    ...extractPdfTextOperatorStrings(text),
    ...extractPdfArrayTextValues(text)
  ];
}

function extractPdfTextOperatorStrings(text) {
  const values = [];
  const stringPattern = /\((?:\\.|[^\\)])*\)\s*T[jJ]/g;
  const hexPattern = /<([0-9a-fA-F\s]+)>\s*T[jJ]/g;
  let match;

  while ((match = stringPattern.exec(text)) !== null) {
    values.push(decodeBasicPdfString(match[0].match(/\((?:\\.|[^\\)])*\)/)[0]));
  }

  while ((match = hexPattern.exec(text)) !== null) {
    values.push(decodePdfHexString(match[1]));
  }

  return values;
}

function extractPdfArrayTextValues(text) {
  const values = [];
  const arrayPattern = /\[(.*?)\]\s*TJ/gs;
  let match;

  while ((match = arrayPattern.exec(text)) !== null) {
    const arrayBody = match[1];
    const tokenPattern = /\((?:\\.|[^\\)])*\)|<([0-9a-fA-F\s]+)>/g;
    let token;
    while ((token = tokenPattern.exec(arrayBody)) !== null) {
      pushPdfTextValue(values, token[0]);
    }
  }

  return values;
}

function pushPdfTextValue(values, value) {
  if (value.startsWith("(")) {
    values.push(decodeBasicPdfString(value));
  } else if (value.startsWith("<")) {
    values.push(decodePdfHexString(value.slice(1, -1)));
  }
}

function decodeBasicPdfString(raw) {
  return raw
    .slice(1, -1)
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1");
}

function decodePdfHexString(hex) {
  const cleaned = hex.replace(/\s+/g, "");
  if (!cleaned) {
    return "";
  }

  const bytes = [];
  for (let index = 0; index < cleaned.length; index += 2) {
    bytes.push(parseInt(cleaned.slice(index, index + 2).padEnd(2, "0"), 16));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(new Uint8Array(bytes.slice(2)));
  }
  return new TextDecoder("latin1").decode(new Uint8Array(bytes));
}

function dedupeTextLines(lines) {
  const result = [];
  const seen = new Set();

  for (const line of lines.map((value) => cleanupExtractedText(value)).filter(Boolean)) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(line);
    }
  }

  return result;
}

async function extractXlsxText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await readZipEntries(bytes);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml") || "";
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const worksheetNames = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort();

  const sections = [];
  for (const worksheetName of worksheetNames) {
    const rows = parseWorksheetRows(entries.get(worksheetName) || "", sharedStrings);
    if (rows.length > 0) {
      sections.push(`[${worksheetName}]\n${rows.join("\n")}`);
    }
  }

  return {
    text: cleanupExtractedText(sections.join("\n\n")),
    warning: sections.length > 0 ? "" : "XLSX 텍스트 없음"
  };
}

async function readZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findZipEndOfCentralDirectory(view);
  if (eocdOffset === -1) {
    throw new Error("XLSX 구조를 읽을 수 없습니다.");
  }

  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decodeUtf8(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);

    let data = null;
    if (compression === 0) {
      data = compressed;
    } else if (compression === 8) {
      data = await inflateBytes(compressed, ["deflate-raw", "deflate"]);
    }

    if (data) {
      entries.set(fileName, decodeUtf8(data));
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findZipEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function parseSharedStrings(xml) {
  const strings = [];
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const textNodes = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi))
      .map((textMatch) => decodeXml(textMatch[1]));
    strings.push(textNodes.join(""));
  }

  return strings;
}

function parseWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const cells = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const value = parseCellValue(attrs, body, sharedStrings);
      if (value) {
        cells.push(value);
      }
    }

    if (cells.length > 0) {
      rows.push(cells.join("\t"));
    }
  }

  return rows;
}

function parseCellValue(attrs, body, sharedStrings) {
  const typeMatch = attrs.match(/\bt="([^"]+)"/i);
  const type = typeMatch ? typeMatch[1] : "";

  if (type === "s") {
    const index = Number((body.match(/<v[^>]*>([\s\S]*?)<\/v>/i) || [])[1]);
    return sharedStrings[index] || "";
  }

  if (type === "inlineStr") {
    return Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi))
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  const value = (body.match(/<v[^>]*>([\s\S]*?)<\/v>/i) || [])[1];
  return value ? decodeXml(value) : "";
}

async function inflateBytes(bytes, formats) {
  if (typeof DecompressionStream === "undefined") {
    return null;
  }

  for (const format of formats) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      // Try the next browser-supported deflate mode.
    }
  }

  return null;
}

function limitText(text, limit) {
  const cleaned = cleanupExtractedText(text);
  if (cleaned.length <= limit) {
    return { text: cleaned, warning: cleaned ? "" : "텍스트 없음" };
  }
  return {
    text: cleaned.slice(0, limit),
    warning: TOO_MUCH_INPUT_MESSAGE
  };
}

function cleanupExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeLatin1(bytes) {
  return new TextDecoder("latin1").decode(bytes);
}
