export const STORAGE_KEYS = {
  selectedPromptId: "esg-report-writer.selectedPromptId",
  selectedRequestPromptId: "esg-report-writer.selectedRequestPromptId"
};

export const DEFAULT_SYSTEM_PROMPT = `당신은 ESG 보고서 편집자입니다.
사용자가 제공한 자료에서 하나의 보고서 컬럼으로 만들 수 있는 단일 주제를 선별하고, 지속가능경영 보고서에 바로 배치할 수 있는 초안을 작성합니다.
보고서 분야는 Business, Environmental, Social, Governance 중 하나로 구분합니다.
첨부 자료는 보도자료, 뉴스, 공시, 사내 설명자료, 표 형태 자료일 수 있으며, 원문을 그대로 요약하지 말고 보고서 문체로 재구성합니다.
첨부 자료에 있는 사실, 수치, 기간, 기관명, 활동명만 근거로 사용하고, 근거가 부족한 내용은 "추가 확인 필요"로 표시합니다.
자료에 여러 이슈가 섞여 있으면 사용자의 요청을 우선하고, 요청이 모호하면 단일 컬럼으로 가장 완성도가 높은 하나의 주제만 선택합니다.
전체 보고서 개요가 아니라 하나의 독립적인 보고서 컬럼 완성도를 우선합니다.
회사 로고, 외부 이미지, 실제 사진은 넣지 말고 회사명이나 기관명은 텍스트로만 표기합니다.
전체 분량은 본문 텍스트와 핵심 근거 설명을 중심으로 하고, 도식, 표, 추진체계, KPI, 인포그래픽은 내용을 보조하는 하단 요소로 구성합니다.`;

export const DEFAULT_REQUEST_PROMPT = "업로드한 보도자료나 참고 자료를 바탕으로 지속가능경영 보고서의 단일 컬럼 초안을 작성해줘. 제목, 본문 중심 설명, 핵심 근거, 하단 도식/표/인포그래픽 설계까지 구성하되, 시각 요소는 자료 기반 메시지를 보조하도록 만들어줘.";

export const MANDATORY_SYSTEM_APPENDIX = `추가 고정 지침:
1. 답변은 HTML이어야 하며, Markdown 코드펜스 없이 바로 렌더링 가능한 HTML만 출력한다.
2. 외부 CDN 연결이 불가하므로 JS, CSS, 폰트, 이미지 등 외부 스크립트와 외부 리소스 연결은 절대 사용하지 않는다.
3. script, iframe, object, embed, link 태그를 사용하지 않는다.
4. 스타일이 필요하면 HTML 내부의 style 태그 또는 인라인 style만 사용한다.
5. 색상 톤은 흰색 배경, 검정 본문, 하나의 포인트 컬러, 옅은 회색 보조면을 중심으로 통일하고, 표와 인포그래픽은 인쇄/PDF 저장 시에도 읽기 쉽게 구성한다.
6. 전체 결과는 독립적인 단일 보고서 컬럼처럼 제목, 요약, 본문, 핵심 근거, 보조 표 또는 시각 요소, 리스크/확인 필요 사항을 포함한다.
7. 사용자가 보낸 [보고서 분야]와 [권장 HTML 테마]를 우선 적용한다.
8. 회사 로고, 외부 이미지, 실제 사진은 출력하지 않는다. 필요하면 회사명/기관명만 텍스트로 표기한다.`;

export const VISUAL_SPEC_GUIDE = `보고서 시각화 설계 visualSpec.type 선택지:
- kpi_cards: 정량 지표, 성과 수치, 목표 수치를 3~5개 카드로 요약할 때 사용한다.
- metric_table: 구분별 수치, 기간, 성과, 계획을 표로 비교할 때 사용한다.
- process_flow: 투입-활동-결과, 신청-검토-실행, 수거-처리-재활용처럼 순서가 있는 활동을 표현할 때 사용한다.
- strategy_flow: 상위 목표, 핵심 전략, 실행 과제를 한 줄 또는 계층형 흐름으로 보여줄 때 사용한다.
- roadmap_timeline: 연도, 분기, 단계, 단기/중기/장기 계획이 있는 경우 사용한다.
- governance_structure: 이사회, 위원회, 전담 조직, 보고 체계를 보여줄 때 사용한다.
- risk_control_matrix: 리스크, 대응 활동, 통제/모니터링, 확인 필요 사항을 함께 보여줄 때 사용한다.
- stakeholder_map: 고객, 임직원, 협력사, 지역사회, 주주 등 이해관계자별 활동을 정리할 때 사용한다.
- value_chain_map: 원재료, 생산, 물류, 사용, 폐기/재활용 등 가치사슬 단계별 영향을 보여줄 때 사용한다.
- circular_loop: 자원순환, 폐기물 재활용, 물/에너지 순환처럼 반복 순환 구조를 표현할 때 사용한다.
- materiality_matrix: 중요도, 영향도, 우선순위 축이 자료에 명확히 있을 때만 사용한다.
- before_after_comparison: 제도 도입 전후, 개선 전후, 기존/변경 체계를 비교할 때 사용한다.
- initiative_portfolio: 여러 활동을 영역별 묶음으로 보여줄 때 사용한다.
- policy_system: 정책, 원칙, 실행, 점검, 개선으로 이어지는 관리 체계를 보여줄 때 사용한다.
- target_progress: 목표 대비 실적, 현재 수준, 향후 과제를 표현할 때 사용한다.
선택 규칙:
1. 자료에 수치가 충분하면 kpi_cards, metric_table, target_progress 중 하나를 우선 검토한다.
2. 과정이나 운영 체계가 중요하면 process_flow, strategy_flow, policy_system을 우선 검토한다.
3. 조직/관리/리스크 주제는 governance_structure, risk_control_matrix를 우선 검토한다.
4. 이해관계자 활동은 stakeholder_map, 공급망/제품 생애주기는 value_chain_map, 순환경제는 circular_loop을 우선 검토한다.
5. 자료 근거가 부족한 시각화 유형을 억지로 고르지 말고, 근거 카드와 간단한 표로 보수적으로 구성한다.`;

export const REPORT_PLAN_PROMPT = `1차 작업: 보고서 내용 및 시각화 설계 JSON 작성
역할:
- 첨부 자료와 사용자 요청을 읽고, 하나의 보고서 컬럼에 들어갈 내용 설계서를 만든다.
- HTML을 작성하지 않는다. Markdown도 작성하지 않는다.
- 반드시 JSON 객체만 출력한다.
- 첨부 자료에 없는 수치, 성과, 일정, 기관명, 목표는 만들지 않는다.
- 근거가 부족하면 해당 필드에 "추가 확인 필요"라고 적는다.

${VISUAL_SPEC_GUIDE}

JSON 스키마:
{
  "field": "Business | Environmental | Social | Governance",
  "accent": "business | environmental | social | governance",
  "topic": "단일 컬럼 주제",
  "title": "보고서 컬럼 제목",
  "sourceNote": "사용한 자료, 기관명, 기간을 텍스트로 요약",
  "lead": "도입 요약 문단",
  "bodyParagraphs": ["본문 문단 1", "본문 문단 2", "본문 문단 3"],
  "evidenceCards": [
    { "label": "근거 라벨", "value": "핵심 값 또는 키워드", "description": "자료 기반 설명" }
  ],
  "visualSpec": {
    "type": "위 선택지 중 하나",
    "title": "도식 제목",
    "rationale": "이 도식 유형을 선택한 이유",
    "items": [
      { "label": "항목명", "value": "값 또는 단계명", "description": "자료 기반 설명" }
    ],
    "columns": ["필요한 경우 표/매트릭스 열"],
    "rows": [["필요한 경우 행 값"]]
  },
  "tableSpec": {
    "title": "보조 표 제목",
    "columns": ["구분", "내용"],
    "rows": [["항목", "자료 기반 내용"]]
  },
  "uncertainFacts": ["추가 확인 필요 사항"],
  "renderNotes": ["HTML 변환 시 강조할 시각 구성 또는 주의점"]
}

작성 규칙:
1. bodyParagraphs는 2~4개로 작성한다.
2. evidenceCards는 3개를 우선 작성하되, 근거가 부족하면 2개까지 허용한다.
3. visualSpec은 반드시 포함하고, type은 선택지 중 하나만 사용한다.
4. tableSpec은 visualSpec과 중복되더라도 HTML 변환 시 보조 근거로 쓸 수 있게 작성한다.
5. JSON 문자열 안 줄바꿈은 피하고, 유효한 JSON만 출력한다.`;

export const HTML_RENDER_PROMPT = `2차 작업: 보고서 설계 JSON을 HTML로 변환
역할:
- 입력으로 받은 보고서 설계 JSON만 근거로 HTML 보고서 컬럼을 작성한다.
- 새로운 사실, 수치, 일정, 기관명, 목표를 추가하지 않는다.
- JSON의 visualSpec과 tableSpec을 반드시 반영한다.
- visualSpec.type에 맞는 도식/표/인포그래픽을 HTML/CSS로 구현한다.
- 외부 이미지, 아이콘, CDN, script는 사용하지 않는다.
- 출력은 Markdown 코드펜스 없이 body 내부에 넣을 수 있는 HTML fragment만 작성한다.

visualSpec.type 렌더링 규칙:
- kpi_cards: 수치/키워드를 굵게 보여주는 카드 3~5개와 짧은 설명을 배치한다.
- metric_table: 비교가 잘 보이도록 표를 중심으로 구성한다.
- process_flow: 단계형 카드와 얇은 연결선 느낌의 흐름을 만든다.
- strategy_flow: 상위 목표 바, 전략 카드, 실행 과제 카드 순서로 구성한다.
- roadmap_timeline: 좌우 또는 상하 타임라인을 만들되 단일 컬럼 폭 안에서 넘치지 않게 한다.
- governance_structure: 보고/감독/실행 주체를 계층형 카드로 표현한다.
- risk_control_matrix: 리스크-대응-점검 표 또는 3열 매트릭스로 표현한다.
- stakeholder_map: 이해관계자별 카드 또는 방사형이 아닌 안정적인 그리드로 표현한다.
- value_chain_map: 가치사슬 단계를 순서형 카드로 표현한다.
- circular_loop: 순환 구조를 카드와 화살표 텍스트로 표현한다.
- materiality_matrix: 실제 축 근거가 있을 때만 2축 매트릭스로 표현하고, 없으면 우선순위 표로 낮춰 표현한다.
- before_after_comparison: Before/After 또는 기존/개선 2열 비교로 표현한다.
- initiative_portfolio: 영역별 활동 묶음 카드 그리드로 표현한다.
- policy_system: 정책-실행-점검-개선 관리 체계로 표현한다.
- target_progress: 목표, 현재, 향후 과제를 진행 바 또는 표로 표현한다.

공통 클래스 사용 규칙:
- 최상위는 <main class="esg-report-column" data-accent="business|environmental|social|governance">로 시작한다.
- 제목 영역은 column-header, column-eyebrow, column-title, column-source를 사용하고, 제목 아래에는 column-rule을 둔다.
- 본문은 column-body 안에 배치하고, 문단 2~4개와 section title을 포함한다.
- 핵심 근거는 column-evidence와 column-card를 사용한다. 카드 안의 핵심 값은 strong 태그로 표시한다.
- column-evidence의 직접 자식은 column-card만 둔다. visual-grid, visual-row, column-flow, column-table, table은 column-evidence 안에 중첩하지 말고 별도 column-visual 또는 형제 표로 분리한다.
- 하단 시각 요소는 <section class="column-visual" data-visual-type="...">로 만들고, visualSpec.type에 따라 visual-grid, column-flow, visual-step, visual-band, visual-timeline, visual-comparison, visual-matrix, visual-track, column-table 중 적절한 클래스를 조합한다.
- tableSpec을 표로 렌더링할 때는 column-evidence 밖에 두고 table에 column-table 클래스를 부여한다.
- 복잡한 절대 위치, 실제 이미지처럼 보이기 위한 장식, 큰 빈 박스는 피하고, 선/라벨/작은 박스/표 조합으로 지면형 도식을 만든다.

품질 규칙:
1. 본문과 핵심 근거 설명이 정보량의 중심이어야 한다.
2. 도식은 장식이 아니라 자료 기반 메시지를 요약해야 한다.
3. 한 컬럼 폭에서 읽히도록 큰 박스, 과도한 카드 수, 복잡한 절대 위치를 피한다.
4. JSON에 없는 내용은 "추가 확인 필요"로만 표기한다.
5. 최상위는 <main class="esg-report-column" data-accent="...">를 사용한다.`;

export const COMMON_HTML_TEMPLATE_PROMPT = `공통 HTML 보고서 템플릿 지침:
1. 제공 자료에서 하나의 지속가능경영 보고서 컬럼(단일 주제 지면)을 완성한다.
2. body 내부에 들어갈 HTML fragment만 출력한다. 앱이 공통 CSS를 자동 주입하므로 style 태그는 꼭 필요한 보정에만 최소 사용한다.
3. 최상위는 반드시 <main class="esg-report-column" data-accent="business|environmental|social|governance">이다.
4. 여러 페이지, 좌우 스프레드, page-left/page-right, PDF 뷰어, 메뉴, 버튼, 외부 이미지/아이콘은 만들지 않는다.
5. 기본 순서는 header -> rule -> body -> evidence -> visual/table -> footnote이다.
6. column-evidence의 직접 자식은 column-card만 사용한다. 도식, 그리드, 흐름도, 표는 반드시 column-evidence를 닫은 뒤 column-visual 또는 column-table 형제 요소로 둔다.
7. 본문과 핵심 근거 설명이 정보량의 중심이어야 하며, 하단 도식/표는 자료 기반 메시지를 보조한다.
8. 보도자료형 원문은 홍보 문구를 반복하지 말고 "누가/언제/무엇을/어떤 규모로/왜 중요한지/향후 계획"을 보고서 문체로 재구성한다.
9. 자료에 없는 성과 수치, 감축량, 투자액, 일정은 만들지 말고 "추가 확인 필요"라고 표기한다.
10. 색상은 data-accent만 정확히 지정한다. Business=business, Environmental=environmental, Social=social, Governance=governance.

사용 가능한 공통 클래스:
- header: column-header, column-eyebrow, column-title, column-source, column-rule
- body: column-body, column-section-title, column-lead
- evidence: column-evidence, column-card, column-footnote
- visual: column-visual, column-visual-title, column-flow, column-pill, visual-band, visual-row, visual-grid, visual-matrix, visual-comparison, visual-loop, visual-step, visual-node, visual-timeline, visual-timeline-item, visual-track, visual-fill
- table: column-table

권장 골격:
<main class="esg-report-column" data-accent="business">
  <header class="column-header">
    <p class="column-eyebrow">보고서 분야 / 세부 주제</p>
    <h1 class="column-title">단일 컬럼 제목</h1>
    <p class="column-source">자료 출처 또는 관련 기관명 텍스트</p>
  </header>
  <div class="column-rule"></div>
  <section class="column-body">
    <h2 class="column-section-title">핵심 내용</h2>
    <p class="column-lead">첨부 자료 기반 요약 문단</p>
    <p>주요 활동, 성과, 기간, 조직, 정량 지표를 문장으로 정리</p>
  </section>
  <section class="column-evidence">
    <div class="column-card"><strong>핵심 근거</strong>자료 기반 설명</div>
  </section>
  <section class="column-visual" data-visual-type="visualSpec.type">
    <h2 class="column-visual-title">도식 제목</h2>
    <div class="column-flow">
      <div class="visual-band">상위 목표 또는 핵심 전략</div>
      <div class="visual-row">
        <div class="visual-step"><strong>실행 과제</strong>세부 실행 내용</div>
      </div>
    </div>
  </section>
  <table class="column-table"><thead><tr><th>구분</th><th>근거 내용</th></tr></thead><tbody><tr><td>항목</td><td>자료 기반 내용</td></tr></tbody></table>
  <p class="column-footnote">자료에 없는 수치나 일정은 추가 확인 필요로 표시</p>
</main>`;

export const REPORT_SHELL_STYLE = `
  :root {
    color-scheme: light;
    --report-ink: #111111;
    --report-muted: #656565;
    --report-orange: #eda53a;
    --report-orange-dark: #cf8117;
    --report-line: #d7d2ca;
    --report-soft: #f5f5f2;
    --report-warm: #fff7ea;
  }
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #ffffff;
    color: var(--report-ink);
    font-family: "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", Arial, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
    line-height: 1.62;
  }
  .report-shell {
    margin: 0 auto;
    max-width: 980px;
    padding: 34px;
  }
  h1, h2, h3 {
    color: var(--report-ink);
    line-height: 1.25;
    margin: 0 0 14px;
  }
  h1 {
    border-bottom: 3px solid var(--report-orange);
    font-size: 30px;
    padding-bottom: 14px;
  }
  h2 {
    border-left: 5px solid var(--report-orange);
    font-size: 22px;
    margin-top: 30px;
    padding-left: 12px;
  }
  h3 {
    color: var(--report-orange-dark);
    font-size: 17px;
    margin-top: 22px;
  }
  p { margin: 0 0 13px; }
  table {
    border-collapse: collapse;
    margin: 16px 0 22px;
    width: 100%;
  }
  th, td {
    border: 1px solid var(--report-line);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--report-soft);
    color: var(--report-orange-dark);
    font-weight: 800;
  }
  ul, ol { padding-left: 22px; }
  img, svg, canvas {
    height: auto;
    max-width: 100%;
  }
  pre {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .kpi-grid,
  .metric-grid,
  .cards {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    margin: 18px 0;
  }
  .kpi-card,
  .metric-card,
  .card {
    background: var(--report-soft);
    border: 1px solid var(--report-line);
    border-radius: 8px;
    padding: 14px;
  }
  .esg-report-column {
    --column-accent: #5da5d8;
    --column-border: #b8d9ee;
    --column-soft: #edf7fd;
    --column-soft-2: #f7fbfe;
    background: #ffffff;
    color: var(--report-ink);
    margin: 0 auto;
    max-width: 100%;
    min-height: 188mm;
    overflow-wrap: break-word;
    padding: 8mm 3mm 6mm;
    width: 136mm;
  }
  .esg-report-column[data-accent="business"],
  .esg-report-column[data-accent="blue"] {
    --column-accent: #5da5d8;
    --column-border: #b8d9ee;
    --column-soft: #edf7fd;
    --column-soft-2: #f7fbfe;
  }
  .esg-report-column[data-accent="environmental"],
  .esg-report-column[data-accent="green"] {
    --column-accent: #6faf7b;
    --column-border: #a7d0ae;
    --column-soft: #eef8f1;
    --column-soft-2: #f7fbf8;
  }
  .esg-report-column[data-accent="social"],
  .esg-report-column[data-accent="orange"] {
    --column-accent: #e8a13b;
    --column-border: #efc47c;
    --column-soft: #fff5e4;
    --column-soft-2: #fffbf3;
  }
  .esg-report-column[data-accent="governance"] {
    --column-accent: #df7a56;
    --column-border: #e9aa90;
    --column-soft: #fff1ea;
    --column-soft-2: #fff8f5;
  }
  .column-header { margin-bottom: 14px; }
  .column-eyebrow {
    color: var(--column-accent);
    font-size: 18px;
    font-weight: 900;
    line-height: 1.18;
    margin: 0 0 6px;
  }
  .column-title {
    border: 0;
    color: #111111;
    font-size: 28px;
    font-weight: 900;
    letter-spacing: 0;
    line-height: 1.16;
    margin: 0 0 14px;
    padding: 0;
  }
  .column-section-title {
    border: 0;
    color: var(--column-accent);
    font-size: 13.5px;
    font-weight: 900;
    line-height: 1.3;
    margin: 0 0 8px;
    padding: 0;
  }
  .column-lead,
  .column-body p {
    color: #171717;
    font-size: 11.2px;
    line-height: 1.72;
    margin: 0 0 10px;
  }
  .column-source {
    color: #777777;
    font-size: 10.3px;
    line-height: 1.45;
    margin: -4px 0 12px;
  }
  .column-rule {
    border-top: 1px solid #a8a8a8;
    margin: 14px 0 12px;
  }
  .column-visual,
  .column-diagram {
    background: var(--column-soft);
    border-top: 1px solid var(--column-border);
    margin-top: 12px;
    padding: 12px;
  }
  .column-visual-title {
    color: var(--column-accent);
    font-size: 12px;
    font-weight: 900;
    line-height: 1.3;
    margin: 0 0 9px;
  }
  .column-flow {
    display: grid;
    gap: 8px;
  }
  .column-flow.is-horizontal,
  .visual-row {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  }
  .column-pill {
    border: 1px solid var(--column-border);
    border-radius: 999px;
    background: #ffffff;
    color: var(--column-accent);
    font-size: 10.3px;
    font-weight: 800;
    line-height: 1.35;
    padding: 7px 10px;
    text-align: center;
  }
  .visual-band {
    background: var(--column-accent);
    color: #ffffff;
    font-size: 10.5px;
    font-weight: 900;
    line-height: 1.35;
    padding: 7px 12px;
    text-align: center;
  }
  .visual-grid,
  .visual-matrix,
  .visual-comparison,
  .visual-loop {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  .visual-grid.is-three {
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  }
  .visual-grid > *,
  .visual-matrix > *,
  .visual-comparison > *,
  .visual-loop > *,
  .visual-row > * {
    min-width: 0;
  }
  .visual-grid > .column-grid,
  .visual-row > .column-grid {
    background: #ffffff;
    border: 1px solid var(--column-border);
    color: #111111;
    font-size: 10.2px;
    line-height: 1.42;
    padding: 8px 9px;
  }
  .visual-step,
  .visual-node {
    background: #ffffff;
    border: 1px solid var(--column-border);
    color: #111111;
    font-size: 10.2px;
    line-height: 1.42;
    min-width: 0;
    padding: 8px 9px;
  }
  .visual-step strong,
  .visual-node strong {
    color: var(--column-accent);
    display: block;
    font-size: 10.8px;
    line-height: 1.3;
    margin-bottom: 4px;
  }
  .visual-timeline {
    border-left: 2px solid var(--column-border);
    display: grid;
    gap: 8px;
    padding-left: 10px;
  }
  .visual-timeline-item {
    background: #ffffff;
    border: 1px solid var(--column-border);
    font-size: 10.2px;
    line-height: 1.42;
    padding: 8px 9px;
  }
  .visual-track {
    background: #ffffff;
    border: 1px solid var(--column-border);
    height: 10px;
    margin-top: 6px;
  }
  .visual-fill {
    background: var(--column-accent);
    height: 100%;
    max-width: 100%;
  }
  .column-card {
    background: #ffffff;
    border: 1px solid var(--column-border);
    border-radius: 2px;
    color: #111111;
    font-size: 10.3px;
    line-height: 1.45;
    min-width: 0;
    padding: 9px 10px;
  }
  .column-card strong {
    color: var(--column-accent);
    display: block;
    font-size: 13.2px;
    line-height: 1.25;
    margin-bottom: 4px;
  }
  .column-card small {
    color: #666666;
    display: block;
    font-size: 9.5px;
    line-height: 1.35;
    margin-top: 4px;
  }
  .column-evidence {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    margin: 12px 0;
  }
  .column-evidence > .evidence-wide,
  .column-evidence > .column-visual,
  .column-evidence > .column-diagram,
  .column-evidence > .visual-grid,
  .column-evidence > .visual-matrix,
  .column-evidence > .visual-comparison,
  .column-evidence > .visual-loop,
  .column-evidence > .visual-row,
  .column-evidence > .column-flow,
  .column-evidence > .column-table,
  .column-evidence > table {
    grid-column: 1 / -1 !important;
    width: 100% !important;
  }
  .column-table {
    border-collapse: collapse;
    font-size: 10.3px;
    margin-top: 10px;
    table-layout: fixed;
    width: 100%;
  }
  .column-table th,
  .column-table td {
    border: 1px solid var(--column-border);
    overflow-wrap: anywhere;
    padding: 7px 8px;
    vertical-align: top;
  }
  .column-table th {
    background: var(--column-soft-2);
    color: var(--column-accent);
    font-weight: 900;
  }
  .column-footnote {
    color: #666666;
    font-size: 9.6px;
    line-height: 1.45;
    margin-top: 8px;
  }
  .esg-report-spread {
    background: #ffffff;
    color: var(--report-ink);
    display: grid;
    gap: 12mm;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    margin: 0 auto;
    min-height: 210mm;
    min-width: 297mm;
    padding: 18mm 19mm 14mm;
    width: 297mm;
  }
  .spread-page {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .spread-page h1,
  .spread-page h2,
  .spread-page h3 {
    border: 0;
    margin: 0;
    padding: 0;
  }
  .spread-kicker {
    color: var(--report-orange);
    font-size: 22px;
    font-weight: 900;
    line-height: 1.05;
    margin: 0 0 4px;
  }
  .spread-title {
    color: #050505;
    font-size: 31px;
    font-weight: 900;
    letter-spacing: 0;
    line-height: 1.12;
    margin: 0 0 22px;
  }
  .spread-section-title {
    color: var(--report-orange);
    font-size: 15px;
    font-weight: 900;
    margin: 0 0 8px;
  }
  .spread-summary {
    color: #171717;
    font-size: 12.5px;
    line-height: 1.72;
    margin: 0 0 14px;
  }
  .spread-rule {
    border-top: 1px solid #9a9a9a;
    margin: 13px 0 10px;
  }
  .spread-diagram,
  .spread-org,
  .spread-table-wrap {
    border-top: 1px solid #9a9a9a;
    margin-top: 10px;
    padding-top: 12px;
  }
  .spread-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .spread-pill {
    border: 1px solid #efb45e;
    border-radius: 999px;
    color: var(--report-orange-dark);
    font-size: 11px;
    font-weight: 800;
    line-height: 1.35;
    padding: 7px 12px;
    text-align: center;
  }
  .spread-bar {
    background: linear-gradient(90deg, #efb45e, #eda53a);
    border-radius: 999px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    padding: 7px 12px;
    text-align: center;
  }
  .spread-card {
    background: var(--report-warm);
    border: 1px solid #efb45e;
    color: #111111;
    font-size: 11px;
    line-height: 1.45;
    padding: 10px 12px;
  }
  .spread-note {
    background: var(--report-soft);
    border-left: 3px solid var(--report-orange);
    color: #222222;
    font-size: 11px;
    line-height: 1.55;
    margin-top: 10px;
    padding: 9px 11px;
  }
  .spread-table {
    border-collapse: collapse;
    font-size: 11px;
    margin: 8px 0 0;
    width: 100%;
  }
  .spread-table th,
  .spread-table td {
    border: 1px solid #e7d2b5;
    padding: 7px 8px;
    vertical-align: top;
  }
  .spread-table th {
    background: #fff3df;
    color: var(--report-orange-dark);
    font-weight: 900;
  }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .report-shell { max-width: none; padding: 18mm; }
    .esg-report-column {
      max-width: none;
      margin: 0 auto;
      min-height: 188mm;
      width: 136mm;
    }
    .esg-report-spread {
      margin: 0;
      min-height: 210mm;
      min-width: 297mm;
      width: 297mm;
    }
  }
`;

export const TEXT_FILE_EXTENSIONS = new Set(["txt", "text", "csv", "tsv"]);
export const SUPPORTED_FILE_EXTENSIONS = new Set(["pdf", "xlsx", "csv", "txt", "text"]);
export const PDFJS_SCRIPT_SRC = "/vendor/pdfjs/pdf.min.js";
export const PDFJS_WORKER_SRC = "/vendor/pdfjs/pdf.worker.min.js";
export const MAX_FILE_CHARS = 60000;
export const MAX_TOTAL_FILE_CHARS = 180000;
export const TOO_MUCH_INPUT_MESSAGE = "입력된 내용이 너무 많습니다.";
