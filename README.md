# ESG Report Writer

프론트 단독으로 OpenAI-compatible LLM 서버를 직접 호출하는 ESG 보고서 작성 POC입니다.

## 주요 기능

- 시스템 프롬프트 저장, 선택, 삭제
- PDF, XLSX, CSV, TXT 다중 업로드
- 로컬 번들 PDF.js 기반 PDF 텍스트 추출 및 XLSX/CSV/TXT 본문 활용
- 사용자 요청과 첨부 자료의 Business/Environmental/Social/Governance 분야 자동 분류
- 시스템 프롬프트와 작성 요청 프롬프트 서버 저장, 선택, 삭제
- `.env` 접속 비밀번호 기반 로그인
- 사용자 요청 1회로 단일 컬럼 HTML 답변 2개 버전 동시 생성
- 생성 HTML 격리 렌더링
- 각 답변별 전체 화면 보기와 PDF 저장용 인쇄 버튼

## 설정

`.env.example`을 `.env`로 복사한 뒤 LLM 서버 주소와 모델명을 지정합니다.

```powershell
Copy-Item .env.example .env
```

```env
OPENAI_COMPATIBLE_BASE_URL=http://127.0.0.1:30000/v1
OPENAI_COMPATIBLE_API_KEY=
LLM_MODEL=Qwen3.6
MAX_TOTAL_FILE_CHARS=180000
APP_ACCESS_PASSWORD=admin
APP_SESSION_SECRET=
APP_SESSION_MAX_AGE_SECONDS=28800
APP_HOST=127.0.0.1
APP_PORT=5173
```

`OPENAI_COMPATIBLE_BASE_URL`에는 `/v1`까지 포함하세요. 앱은 `/chat/completions`를 자동으로 붙입니다.
설정값은 화면에 표시하지 않습니다.
`APP_ACCESS_PASSWORD`는 운영 전에 반드시 변경하세요.
`MAX_TOTAL_FILE_CHARS`는 첨부 자료에서 추출해 1차 LLM 요청에 넣을 최대 글자 수입니다. 32k급 컨텍스트로 서빙한다면 50000~70000 정도로 낮추고, 128k 이상이면 기본값을 사용할 수 있습니다.

## 실행

별도 패키지 설치 없이 Node.js만 있으면 실행됩니다. PDF.js 브라우저 파일은 `vendor/pdfjs/`에 포함되어 있습니다.

```powershell
npm start
```

브라우저에서 `http://127.0.0.1:5173`으로 접속합니다.

## 참고 사항

- LLM 프록시 API는 없습니다. 브라우저가 OpenAI-compatible `/chat/completions` 엔드포인트를 직접 호출합니다.
- 따라서 LLM 서버는 브라우저 Origin에 대한 CORS를 허용해야 합니다.
- API 키가 필요한 서버라면 `.env`의 `OPENAI_COMPATIBLE_API_KEY`를 사용할 수 있지만, 프론트 단독 구조상 브라우저 런타임에는 전달됩니다.
- 시스템 프롬프트와 작성 요청 프롬프트는 서버의 `data/prompts.json`에 저장되어 접속자 모두가 공유합니다.
- 저장된 프롬프트에는 역할과 작성 의도만 두고, 단일 컬럼 HTML 템플릿과 분야별 컬러 팔레트 지침은 `src/app.js`에서 LLM POST 요청 직전에 시스템 프롬프트 뒤에 자동으로 붙입니다.
- PDF 다운로드 버튼은 브라우저 인쇄 기능을 열며, 대상 프린터를 "PDF로 저장"으로 선택하면 렌더링된 HTML을 PDF로 저장할 수 있습니다.
- 외부 CDN, 외부 CSS, 외부 JS를 쓰지 않도록 시스템 프롬프트에 고정 지침을 추가하고, 렌더링 전 위험 태그와 외부 URL을 제거합니다.
- PDF 텍스트 추출은 `vendor/pdfjs/`에 포함된 로컬 PDF.js 번들을 사용합니다. OCR은 하지 않으므로 스캔 이미지 PDF는 텍스트가 추출되지 않을 수 있습니다.
- HWP 등 추가 문서 파서는 `src/file-extractors.js`의 `extractFileText` 분기에 추가하면 됩니다.

## 프론트 구조

- `src/app.js`: 화면 상태, 이벤트 바인딩, 생성 흐름
- `src/config.js`: 기본 프롬프트, 고정 시스템 지침, HTML 템플릿, 파일 제한값
- `src/classification.js`: Business/Environmental/Social/Governance 분류 키워드
- `src/file-extractors.js`: PDF/XLSX/CSV/TXT 텍스트 추출
- `src/report-renderer.js`: LLM HTML 정화, iframe/인쇄용 문서 생성
- `src/llm.js`: OpenAI-compatible chat completions 호출과 오류 정규화
- `src/api.js`, `src/utils.js`: 서버 API wrapper와 공통 유틸
