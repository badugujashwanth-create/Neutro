import type { ReactNode } from 'react'

function splitWord(word: string): [string, string] {
  const clean = word.replace(/[^a-zA-Z]/g, '')
  const pivot = Math.max(1, Math.ceil(clean.length * 0.45))
  return [word.slice(0, pivot), word.slice(pivot)]
}

export function renderBionicSentence(line: string): ReactNode {
  return line.split(' ').map((word, index) => {
    const [head, tail] = splitWord(word)
    return (
      <span key={`${word}-${index}`} className="inline">
        <strong className="font-semibold">{head}</strong>
        {tail}
        {index < line.split(' ').length - 1 ? ' ' : ''}
      </span>
    )
  })
}
