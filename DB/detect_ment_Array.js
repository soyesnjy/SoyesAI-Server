// 심리 검사 결과 분석 감지 멘트
const test_result_ment = [
  { text: "학교생활", class: "school" },
  { text: "친구관계", class: "friend" },
  { text: "가족관계", class: "family" },
  { text: "전반적기분", class: "mood" },
  { text: "불안", class: "unrest" },
  { text: "우울", class: "sad" },
  { text: "신체증상", class: "health" },
  { text: "주의집중", class: "attention" },
  { text: "과잉행동", class: "angry" },
  { text: "분노", class: "movement" },
  { text: "분노", class: "self" },
];

// 인지행동 검사 감지 멘트
const cb_solution_ment = [
  { text: "학교가기싫어", class: "school" },
  { text: "친구인지", class: "friend" },
  { text: "가족인지", class: "family" },
  { text: "그외인지", class: "etc" },
];

module.exports = {
  test_result_ment,
  cb_solution_ment,
};
