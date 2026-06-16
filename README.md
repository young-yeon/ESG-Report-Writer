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
- 각 답변별 전체 화면 보기와 서버 Chromium headless 기반 PDF 다운로드

## 설정

`.env.example`을 `.env`로 복사한 뒤 LLM 서버 주소와 모델명을 지정합니다.

```powershell
Copy-Item .env.example .env
```

```env
OPENAI_COMPATIBLE_BASE_URL=http://127.0.0.1:30000/v1
OPENAI_COMPATIBLE_API_KEY=
LLM_MODEL=Qwen3.6
LLM_THINKING_MODE=auto
MAX_TOTAL_FILE_CHARS=180000
APP_ACCESS_PASSWORD=admin
APP_SESSION_SECRET=
APP_SESSION_MAX_AGE_SECONDS=28800
APP_HOST=127.0.0.1
APP_PORT=5173
PDF_CHROMIUM_PATH=
PDF_CHROMIUM_NO_SANDBOX=false
PDF_RENDER_TIMEOUT_MS=60000
PDF_MAX_HTML_BYTES=8388608
```

`OPENAI_COMPATIBLE_BASE_URL`에는 `/v1`까지 포함하세요. 앱은 `/chat/completions`를 자동으로 붙입니다.
설정값은 화면에 표시하지 않습니다.
`APP_ACCESS_PASSWORD`는 운영 전에 반드시 변경하세요.
`LLM_THINKING_MODE`는 reasoning 출력을 제어합니다. 기본값 `auto`는 모델명이 Qwen3 계열이면 `chat_template_kwargs.enable_thinking=false`와 `/no_think`를 함께 보내고, 그 외 모델은 서버 기본 동작을 그대로 둡니다. 서버가 `chat_template_kwargs`를 거부하면 `soft`로 바꿔 `/no_think`만 보내고, 어떤 제어도 하지 않으려면 `server`로 설정합니다.
`MAX_TOTAL_FILE_CHARS`는 첨부 자료에서 추출해 1차 LLM 요청에 넣을 최대 글자 수입니다. 32k급 컨텍스트로 서빙한다면 50000~70000 정도로 낮추고, 128k 이상이면 기본값을 사용할 수 있습니다.
`PDF_CHROMIUM_PATH`를 비워두면 서버가 `chromium`, `chromium-browser`, `google-chrome-stable`, `google-chrome` 순서로 실행 파일을 찾습니다. 자동 탐지가 안 되면 `/usr/bin/google-chrome-stable`처럼 절대 경로를 지정하세요.
서비스를 root로 실행해야 하는 환경에서 Chromium sandbox 오류가 나면 `PDF_CHROMIUM_NO_SANDBOX=true`로 바꿀 수 있지만, 가능하면 전용 서비스 계정으로 실행하는 편이 좋습니다.

## 실행

별도 패키지 설치 없이 Node.js만 있으면 실행됩니다. PDF.js 브라우저 파일은 `vendor/pdfjs/`에 포함되어 있습니다.

```powershell
npm start
```

브라우저에서 `http://127.0.0.1:5173`으로 접속합니다.

## RHEL9 PDF 변환 패키지

PDF 다운로드는 서버에서 Chromium/Chrome headless를 실행해 HTML을 PDF로 변환합니다. GUI 세션이나 Xvfb는 필요 없습니다.

Google Chrome RPM을 사용할 경우:

```bash
sudo dnf install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo dnf install -y fontconfig google-noto-sans-cjk-ttc-fonts
```

설치 후 `.env`에 다음처럼 지정합니다.

```env
PDF_CHROMIUM_PATH=/usr/bin/google-chrome-stable
PDF_CHROMIUM_NO_SANDBOX=false
```

EPEL의 Chromium 패키지를 사용할 수 있는 서버라면 다음 방식도 가능합니다.

```bash
sudo dnf install -y epel-release
sudo dnf install -y chromium fontconfig google-noto-sans-cjk-ttc-fonts
```

패키지명이 배포판 저장소에 따라 다르면 다음 명령으로 실제 이름을 확인하세요.

```bash
dnf search chromium
dnf search 'noto*cjk*'
```

폐쇄망 반입용 RPM을 준비할 때는 인터넷이 되는 RHEL9 계열 장비에서 다음처럼 의존 RPM까지 내려받아 전달합니다.

```bash
mkdir -p rpm-bundle
sudo dnf install -y dnf-plugins-core
dnf download --resolve --destdir rpm-bundle fontconfig google-noto-sans-cjk-ttc-fonts
curl -fL -o rpm-bundle/google-chrome-stable_current_x86_64.rpm \
  https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
curl -fL -o rpm-bundle/linux_signing_key.pub \
  https://dl.google.com/linux/linux_signing_key.pub
```

로컬 WSL이 ARM64이고 실제 서버가 x86_64라면 dnf 작업 공간은 `/mnt/c`가 아니라 WSL의 리눅스 파일시스템 아래에 두고, `--installroot`와 `--forcearch=x86_64`를 함께 사용합니다.

```bash
PROJECT="/mnt/c/Users/as608/OneDrive/문서/code/esg-report-writer"
WORK="$HOME/esg-rpm-x86_64-work"

sudo rm -rf "$WORK"
mkdir -p "$WORK/rpm-bundle"
sudo dnf install -y dnf-plugins-core

sudo dnf install -y --downloadonly \
  --installroot="$WORK/installroot" \
  --releasever=9 \
  --forcearch=x86_64 \
  --setopt=module_platform_id=platform:el9 \
  --setopt=install_weak_deps=False \
  --setopt=cachedir="$WORK/cache" \
  --downloaddir="$WORK/rpm-bundle" \
  fontconfig google-noto-sans-cjk-ttc-fonts

curl -fL -o "$WORK/rpm-bundle/google-chrome-stable_current_x86_64.rpm" \
  https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
curl -fL -o "$WORK/rpm-bundle/linux_signing_key.pub" \
  https://dl.google.com/linux/linux_signing_key.pub

sudo dnf install -y --downloadonly \
  --installroot="$WORK/installroot" \
  --releasever=9 \
  --forcearch=x86_64 \
  --setopt=module_platform_id=platform:el9 \
  --setopt=install_weak_deps=False \
  --setopt=cachedir="$WORK/cache" \
  --downloaddir="$WORK/rpm-bundle" \
  "$WORK/rpm-bundle/google-chrome-stable_current_x86_64.rpm"

rm -rf "$PROJECT/rpm-bundle"
mkdir -p "$PROJECT/rpm-bundle"
cp -av "$WORK/rpm-bundle/." "$PROJECT/rpm-bundle/"

cd "$PROJECT/rpm-bundle"
sha256sum * > SHA256SUMS.txt
```

폐쇄망 서버에서는 번들 디렉터리에서 설치합니다.

```bash
sudo rpm --import ./rpm-bundle/linux_signing_key.pub
sudo dnf install -y ./rpm-bundle/*.rpm
```

현재 프로젝트 작업 디렉터리에는 다음 x86_64/noarch RPM을 `rpm-bundle/`에 받아둘 수 있습니다. 이 디렉터리는 `.gitignore`에 포함되어 Git에는 올라가지 않습니다.

- `google-chrome-stable_current_x86_64.rpm`
- `fontconfig-2.14.0-2.el9_1.x86_64.rpm`
- `google-noto-sans-cjk-ttc-fonts-20230817-2.el9.noarch.rpm`
- `linux_signing_key.pub`
- `SHA256SUMS.txt`

## 참고 사항

- LLM 프록시 API는 없습니다. 브라우저가 OpenAI-compatible `/chat/completions` 엔드포인트를 직접 호출합니다.
- 따라서 LLM 서버는 브라우저 Origin에 대한 CORS를 허용해야 합니다.
- API 키가 필요한 서버라면 `.env`의 `OPENAI_COMPATIBLE_API_KEY`를 사용할 수 있지만, 프론트 단독 구조상 브라우저 런타임에는 전달됩니다.
- 시스템 프롬프트와 작성 요청 프롬프트는 서버의 `data/prompts.json`에 저장되어 접속자 모두가 공유합니다.
- 저장된 프롬프트에는 역할과 작성 의도만 두고, 단일 컬럼 HTML 템플릿과 분야별 컬러 팔레트 지침은 `src/app.js`에서 LLM POST 요청 직전에 시스템 프롬프트 뒤에 자동으로 붙입니다.
- PDF 다운로드 버튼은 서버의 `/api/pdf`가 Chromium/Chrome headless를 실행해 생성한 PDF 파일을 내려받습니다.
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
