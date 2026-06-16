import { REPORT_SHELL_STYLE } from "./config.js";

export function buildReportDocument(rawHtml, options = {}) {
  const safeBody = options.alreadySafe ? rawHtml : sanitizeModelHtml(rawHtml, options);
  const hasReportContainer =
    /<[^>]+\bclass\s*=\s*["'][^"']*\b(?:report-shell|esg-report-spread|esg-report-column)\b/i.test(safeBody);
  const bodyContent = hasReportContainer
    ? safeBody
    : `<main class="esg-report-column" data-accent="${normalizeAccent(options.accent)}">${safeBody}</main>`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${REPORT_SHELL_STYLE}</style>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;
}

function sanitizeModelHtml(rawHtml, options = {}) {
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

  repairReportStructure(doc.body, options);

  const headStyles = styleNodes.length > 0 ? `<style>${styleNodes.join("\n")}</style>` : "";
  return `${headStyles}${doc.body.innerHTML}`.trim();
}

const ACCENT_ALIASES = {
  b: "business",
  business: "business",
  blue: "business",
  e: "environmental",
  environment: "environmental",
  environmental: "environmental",
  green: "environmental",
  s: "social",
  social: "social",
  orange: "social",
  g: "governance",
  governance: "governance",
  red: "governance"
};

const EVIDENCE_WIDE_SELECTOR = [
  ".column-visual",
  ".column-diagram",
  ".visual-grid",
  ".visual-matrix",
  ".visual-comparison",
  ".visual-loop",
  ".visual-row",
  ".column-flow",
  ".column-table",
  "table"
].join(",");

function repairReportStructure(root, options = {}) {
  const fallbackAccent = normalizeAccent(options.accent);

  root.querySelectorAll(".esg-report-column").forEach((column) => {
    column.setAttribute("data-accent", normalizeAccent(column.getAttribute("data-accent"), fallbackAccent));
    column.querySelectorAll("table:not(.column-table)").forEach((table) => {
      table.classList.add("column-table");
    });
  });

  root.querySelectorAll(".column-evidence").forEach((section) => {
    Array.from(section.children).forEach((child) => {
      const isEvidenceCard = child.classList.contains("column-card");
      const isWideContent =
        child.matches(EVIDENCE_WIDE_SELECTOR) ||
        Boolean(child.querySelector(EVIDENCE_WIDE_SELECTOR)) ||
        (/^(H[1-6]|P|TABLE|SECTION)$/i.test(child.tagName) && !isEvidenceCard);

      if (isWideContent) {
        child.classList.add("evidence-wide");
      }
    });
  });
}

function normalizeAccent(value, fallback = "business") {
  const key = String(value || "").trim().toLowerCase();
  const fallbackKey = String(fallback || "").trim().toLowerCase();
  return ACCENT_ALIASES[key] || ACCENT_ALIASES[fallbackKey] || "business";
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
