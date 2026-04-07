const NUMBERED_LINE = /^\[(\d+)\]\s*(.*)/

export function parseNumberedResult(text: string, expectedCount: number): string[] | null {
  const results = new Array<string>(expectedCount).fill('')

  for (const line of text.split('\n')) {
    const match = line.match(NUMBERED_LINE)
    if (!match) continue
    const idx = parseInt(match[1], 10)
    if (idx >= 0 && idx < expectedCount) {
      results[idx] = match[2].trim()
    }
  }

  const filled = results.filter(r => r.length > 0).length
  return filled >= expectedCount * 0.5 ? results : null
}
