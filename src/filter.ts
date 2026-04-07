/**
 * Line filtering — determines which lines should be translated.
 * Pure logic, no VSCode dependency.
 */

/** Build a set of line numbers inside fenced code blocks (``` ... ```) */
export function buildSkipLines(lines: string[]): Set<number> {
  const skip = new Set<number>()
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    if (/^`{3,}/.test(lines[i].trimStart())) {
      skip.add(i)
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) {
      skip.add(i)
    }
  }
  return skip
}

/** Whether a line contains translatable text (has at least one letter) */
export function isTranslatable(text: string): boolean {
  if (!text.trim()) {
    return false
  }
  // Must contain at least one letter (Latin, CJK, Cyrillic, etc.)
  if (!/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u00c0-\u024f]/.test(text)) {
    return false
  }
  // Skip HTML comments
  if (/^<!--.*-->$/.test(text.trim())) {
    return false
  }
  return true
}
