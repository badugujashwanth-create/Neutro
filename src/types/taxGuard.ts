export type CognitiveBand = 'green' | 'amber' | 'rose'
export type CrashRisk = 'low' | 'high'

export interface CognitiveLoadState {
  overloadScore: number
  attentionStability: number
  minutesSinceLastBreak: number
  overloadThreshold: number
}

export interface CognitiveAssessment {
  band: CognitiveBand
  crashRisk: CrashRisk
  shouldGate: boolean
}

export interface CognitiveSnapshot extends CognitiveAssessment {
  overloadScore: number
  attentionStability: number
  minutesSinceLastBreak: number
}

export type TaxGuardStatus =
  | 'locked'
  | 'remind_later'
  | 'unlocked_pending_decision'
  | 'approved'
  | 'cancelled'
  | 'overridden'

export type TaxGuardOutcome = 'yes' | 'no'

export interface TaxGuardEntry {
  id: string
  url: string
  reason: string
  createdAt: string
  unlockAt: string
  status: TaxGuardStatus
  outcome?: TaxGuardOutcome
  outcomeAt?: string
  overridePhraseConfirmed?: boolean
  context: CognitiveSnapshot
}

export interface TransactionalDetection {
  isTransactional: boolean
  urlMatched: boolean
  domFieldMatched: boolean
  domButtonMatched: boolean
  matchedFieldCount: number
  matchedButtonCount: number
  matchedButtons: HTMLElement[]
}
