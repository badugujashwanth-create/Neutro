const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'by',
  'as',
  'at',
  'that',
  'this',
  'it',
  'from',
  'you',
  'your',
  'we',
  'they',
  'their',
  'our',
  'if',
  'then',
  'so',
  'but',
])

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

export function summarizeText(text: string, maxSentences = 4): string[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []
  if (sentences.length <= maxSentences) return sentences

  const frequency = new Map<string, number>()
  tokenize(text).forEach((token) => {
    frequency.set(token, (frequency.get(token) ?? 0) + 1)
  })

  const scored = sentences.map((sentence, index) => {
    const tokens = tokenize(sentence)
    const tokenScore = tokens.reduce((sum, token) => sum + (frequency.get(token) ?? 0), 0)
    const normalized = tokens.length > 0 ? tokenScore / tokens.length : 0
    const leadBias = 1 - Math.min(index, 8) * 0.03
    return {
      index,
      sentence,
      score: normalized * leadBias,
    }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
}
