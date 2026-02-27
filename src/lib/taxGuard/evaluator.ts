import type { CognitiveAssessment, CognitiveLoadState } from '../../types/taxGuard.ts'

export const DEFAULT_COGNITIVE_STATE: CognitiveLoadState = {
  overloadScore: 38,
  attentionStability: 74,
  minutesSinceLastBreak: 22,
  overloadThreshold: 70,
}

export const SIMULATED_OVERLOAD_STATE: CognitiveLoadState = {
  overloadScore: 88,
  attentionStability: 29,
  minutesSinceLastBreak: 145,
  overloadThreshold: 70,
}

export function evaluateCognitiveLoad(state: CognitiveLoadState): CognitiveAssessment {
  const { overloadScore, attentionStability, minutesSinceLastBreak, overloadThreshold } = state

  const crashRiskHigh =
    overloadScore >= 80 ||
    (overloadScore >= 65 && attentionStability <= 45) ||
    (attentionStability <= 35 && minutesSinceLastBreak >= 70) ||
    minutesSinceLastBreak >= 180

  const band: CognitiveAssessment['band'] =
    overloadScore >= 80 || attentionStability <= 35 || minutesSinceLastBreak >= 120
      ? 'rose'
      : overloadScore >= 60 || attentionStability <= 50 || minutesSinceLastBreak >= 75
        ? 'amber'
        : 'green'

  return {
    band,
    crashRisk: crashRiskHigh ? 'high' : 'low',
    shouldGate: overloadScore >= overloadThreshold || crashRiskHigh,
  }
}
