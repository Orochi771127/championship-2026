// One independent scrolling row per existing language. These labels coexist
// regardless of UI locale; the original glyphs replace the former symbol row.
export const EVOLUTION_WRITING_COLOR = 0x008bff;
export const EVOLUTION_WRITING_ROWS = 6;
export const EVOLUTION_GLYPH_ROW = 4;
export const EVOLUTION_TEXT_ROWS = Object.freeze([
  { language: 'en', row: 0, text: 'EVOLUTION' },
  { language: 'zh-Hant', row: 1, text: '進化' },
  { language: 'ja', row: 2, text: '進化（しんか）' },
  { language: 'vi', row: 3, text: 'TIẾN HÓA' },
  { language: 'th', row: 5, text: 'วิวัฒนาการ' }
].map(Object.freeze));

// The arcade evolution's backdrop streams "evolution" in many languages at once
// (Owner 2026-10-29): these rows plus further languages, shown regardless of UI locale.
export const EVOLUTION_STREAM_WORDS = Object.freeze([...new Set([
  '進化', 'EVOLUTION', '진화', 'ÉVOLUTION', 'EVOLUCIÓN', 'EVOLUZIONE', '進化する', ...EVOLUTION_TEXT_ROWS.map(row => row.text)
])]);

export function evolutionWritingY(row, height) {
  return (row + 0.5) * height / EVOLUTION_WRITING_ROWS;
}
