import type { TransactionalDetection } from '../../types/taxGuard.ts'

const URL_PATTERNS = ['/checkout', '/cart', '/subscribe', '/pricing', '/trial', '/payment']
const CARD_FIELD_HINTS = ['card', 'cvv', 'billing']
const BUY_BUTTON_TEXT = [
  'buy now',
  'complete purchase',
  'place order',
  'start free trial',
  'subscribe',
  'pay',
]

function extractButtonText(node: HTMLElement): string {
  if (node instanceof HTMLInputElement) {
    return `${node.value} ${node.getAttribute('aria-label') ?? ''}`.trim().toLowerCase()
  }

  return `${node.textContent ?? ''} ${node.getAttribute('aria-label') ?? ''}`.trim().toLowerCase()
}

function isCardField(input: HTMLInputElement): boolean {
  const autocomplete = input.autocomplete.trim().toLowerCase()
  if (autocomplete === 'cc-number') return true

  const combined = `${input.name} ${input.id}`.toLowerCase()
  return CARD_FIELD_HINTS.some((hint) => combined.includes(hint))
}

function isBuyButton(node: HTMLElement): boolean {
  const text = extractButtonText(node)
  if (!text) return false

  return BUY_BUTTON_TEXT.some((hint) => text.includes(hint))
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return [...new Set(elements)]
}

export function scanTransactionalContext(currentUrl: string = window.location.href): TransactionalDetection {
  const pathname = new URL(currentUrl).pathname.toLowerCase()
  const urlMatched = URL_PATTERNS.some((pattern) => pathname.includes(pattern))

  const fieldMatches = Array.from(document.querySelectorAll('input')).filter((input) => isCardField(input))

  const buttonCandidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], a, [role="button"]'),
  )

  const buttonMatches = buttonCandidates.filter((node) => isBuyButton(node))

  const domFieldMatched = fieldMatches.length > 0
  const domButtonMatched = buttonMatches.length > 0

  return {
    isTransactional: urlMatched || domFieldMatched || domButtonMatched,
    urlMatched,
    domFieldMatched,
    domButtonMatched,
    matchedFieldCount: fieldMatches.length,
    matchedButtonCount: buttonMatches.length,
    matchedButtons: uniqueElements(buttonMatches),
  }
}
