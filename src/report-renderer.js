import { REPORT_SHELL_STYLE } from "./config.js";

export function buildReportDocument(rawHtml, options = {}) {
  const safeBody = options.alreadySafe ? rawHtml : sanitizeModelHtml(rawHtml);
  const hasReportContainer =
    safeBody.includes("report-shell") ||
    safeBody.includes("esg-report-spread") ||
    safeBody.includes("esg-report-column");
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${REPORT_SHELL_STYLE}</style>
  </head>
  <body>
    ${hasReportContainer ? safeBody : `<main class="report-shell">${safeBody}</main>`}
  </body>
</html>`;
}

export function buildPrintableDocument(reportDocument) {
  const reportBody = extractBodyHtml(reportDocument);
  const reportHead = extractHeadHtml(reportDocument);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>ESG 보고서 PDF 저장</title>
    ${reportHead}
    <style>
      .print-toolbar {
        align-items: center;
        background: #17201c;
        color: #ffffff;
        display: flex;
        gap: 10px;
        justify-content: space-between;
        left: 0;
        padding: 10px 14px;
        position: sticky;
        right: 0;
        top: 0;
        z-index: 9999;
      }
      .print-toolbar button {
        background: #0f8b5f;
        border: 0;
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        min-height: 34px;
        padding: 0 12px;
      }
      .print-toolbar span {
        font-family: Arial, "Malgun Gothic", sans-serif;
        font-size: 13px;
      }
      @media print {
        .print-toolbar { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <span>대상 프린터를 PDF로 저장으로 선택하세요.</span>
      <button type="button" onclick="window.print()">PDF로 저장</button>
    </div>
    ${reportBody}
    <script>
      window.opener = null;
      window.addEventListener("load", function () {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 350);
      });
    </script>
  </body>
</html>`;
}

function sanitizeModelHtml(rawHtml) {
  const unwrapped = unwrapHtml(rawHtml);
  const parser = new DOMParser();
  const isFullDocument = /<html[\s>]/i.test(unwrapped) || /<body[\s>]/i.test(unwrapped);
  const doc = parser.parseFromString(
    isFullDocument ? unwrapped : `<!doctype html><html><body>${unwrapped}</body></html>`,
    "text/html"
  );

  const blockedSelectors = [
    "script",
    "iframe",
    "object",
    "embed",
    "link",
    "meta[http-equiv]",
    "form"
  ];
  doc.querySelectorAll(blockedSelectors.join(",")).forEach((node) => node.remove());

  const styleNodes = Array.from(doc.head.querySelectorAll("style"))
    .map((style) => sanitizeCss(style.textContent || ""))
    .filter(Boolean);

  doc.body.querySelectorAll("style").forEach((style) => {
    style.textContent = sanitizeCss(style.textContent || "");
  });

  doc.body.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (["src", "href", "xlink:href"].includes(name) && isExternalOrScriptUrl(value)) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (name === "style") {
        node.setAttribute(attr.name, sanitizeCss(value));
      }
    }
  });

  const headStyles = styleNodes.length > 0 ? `<style>${styleNodes.join("\n")}</style>` : "";
  return `${headStyles}${doc.body.innerHTML}`.trim();
}

function unwrapHtml(content) {
  const htmlFence = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (htmlFence ? htmlFence[1] : content).trim();
}

function sanitizeCss(css) {
  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\((?!\s*['"]?data:)[^)]+\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "");
}

function isExternalOrScriptUrl(value) {
  return /^(https?:)?\/\//i.test(value) || /^javascript:/i.test(value);
}

function extractHeadHtml(documentHtml) {
  const match = String(documentHtml).match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : "";
}

function extractBodyHtml(documentHtml) {
  const match = String(documentHtml).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : documentHtml;
}
