const digitNames: Record<string, string> = {
  "0": "零",
  "1": "一",
  "2": "二",
  "3": "三",
  "4": "四",
  "5": "五",
  "6": "六",
  "7": "七",
  "8": "八",
  "9": "九",
};

function speakDigits(value: string, separator = "、") {
  return value.split("").map((digit) => digitNames[digit] ?? digit).join(separator);
}

/**
 * Build a speech-only copy of an editorial script.
 *
 * Display copy deliberately remains untouched. Rules here target identifiers,
 * versions, model suffixes and year/date codes; quantities, prices, percentages
 * and benchmark scores keep their ordinary numeric reading.
 */
export function normalizeTtsScript(script: string): string {
  return script
    .replace(/DeepSeek[-‑ ]?V?4\.1[-‑ ]?Flash[-‑ ]?1017/gi, "DeepSeek V 四点一 Flash 十月十七日版")
    .replace(/V4\.1\s+Flash\s+1017/gi, "V 四点一 Flash 十月十七日版")
    .replace(/DeepSeek\s+4\.1\s+Flash/gi, "DeepSeek 四点一 Flash")
    .replace(/V4\.1\s+Flash/gi, "V 四点一 Flash")
    .replace(/(?<!\d)1017(?!\d)/g, "一、零、一、七")
    .replace(/\b(20\d{2})(?=\s*年)/g, (year) => speakDigits(year, ""))
    .replace(/\b([A-Z])([0-9]{2,4})\b/g, (_match, prefix: string, digits: string) => `${prefix} ${speakDigits(digits)}`);
}

export const ttsPronunciationNotes = [
  "模型后缀 1017 在完整名称中读作“十月十七日版”，单独出现时逐位读作“一、零、一、七”。",
  "年份按年份读法逐位播报；H200 等硬件编号中的数字逐位播报。",
  "参数量、价格、百分比、基准分数、上下文长度等仍按正常数值读法。",
];

export function formatDurationZh(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder} 秒`;
  return `${minutes} 分 ${remainder.toString().padStart(2, "0")} 秒`;
}
