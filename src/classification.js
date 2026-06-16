import { escapeRegExp } from "./utils.js";

export const REPORT_CATEGORIES = {
  B: {
    label: "Business",
    accent: "business",
    keywords: [
      "business", "사업", "해외사업", "미래성장", "성장", "시장", "매출", "수익",
      "투자", "계약", "mou", "입찰", "사업권", "프로젝트", "포트폴리오", "경쟁력",
      "고객", "디지털", "기술", "r&d", "연구개발", "전략", "확장", "신규",
      "전력그룹", "발전사업", "송배전", "인프라", "운영 효율", "경제성"
    ]
  },
  E: {
    label: "Environmental",
    accent: "environmental",
    keywords: [
      "environmental", "환경", "기후", "온실가스", "탄소", "탄소중립", "무탄소",
      "배출", "에너지", "재생에너지", "청정", "청정수소", "수소", "암모니아",
      "폐기물", "수자원", "용수", "오염", "생물다양성", "재활용", "친환경",
      "스코프", "scope", "ghg", "re100", "net zero", "chps", "lcoe", "연료전환"
    ]
  },
  S: {
    label: "Social",
    accent: "social",
    keywords: [
      "social", "사회", "안전", "안전경영", "안전보건", "보건", "임직원", "근로자",
      "인권", "다양성", "포용", "노동", "공급망", "협력사", "개인정보",
      "지역사회", "교육", "산업재해", "소비자", "품질", "재난", "상생",
      "안전문화", "중대재해", "재해", "고객 보호"
    ]
  },
  G: {
    label: "Governance",
    accent: "governance",
    keywords: [
      "governance", "지배구조", "이사회", "감사", "윤리", "윤리경영", "준법",
      "컴플라이언스", "부패", "반부패", "리스크", "주주", "내부통제", "투명",
      "경영진", "공시", "보상", "독립성", "청렴", "감사위원회", "iso 37001",
      "신고", "상담채널", "리더십"
    ]
  }
};

export function classifyReportField(text) {
  const normalized = String(text || "").toLowerCase();
  const scores = Object.entries(REPORT_CATEGORIES).map(([key, category]) => {
    const score = category.keywords.reduce((sum, keyword) => {
      const pattern = new RegExp(escapeRegExp(keyword.toLowerCase()), "g");
      return sum + (normalized.match(pattern) || []).length;
    }, 0);
    return {
      key,
      label: category.label,
      accent: category.accent,
      score
    };
  });

  scores.sort((left, right) => right.score - left.score);
  const [top] = scores;

  if (!top || top.score === 0) {
    return {
      key: "none",
      label: "분류 대기",
      accent: "business",
      score: 0
    };
  }

  return top;
}
