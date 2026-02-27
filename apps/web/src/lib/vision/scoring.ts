import type { NeutralBaseline } from './calibration.ts'

export type MoodLabel = 'Calm' | 'Focused' | 'Stressed' | 'Frustrated' | 'Neutral'

export interface StressScoringInput {
  hasFace: boolean
  blendshapeMap: Record<string, number>
  baseline: NeutralBaseline | null
  headJitter: number
  fps: number
  previousEmaStress: number
}

export interface StressScoringResult {
  stressScore: number
  moodLabel: MoodLabel
  confidence: number
  emaStress: number
  eyeBlink: number
  tensionSignal: number
}

const EMA_ALPHA = 0.22
const STRESS_WEIGHTS: Record<string, number> = {
  browDownLeft: 1.2,
  browDownRight: 1.2,
  jawClench: 1.6,
  mouthPressLeft: 1.2,
  mouthPressRight: 1.2,
  noseSneerLeft: 0.7,
  noseSneerRight: 0.7,
  eyeWideLeft: 0.6,
  eyeWideRight: 0.6,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function shapeValue(blendshapeMap: Record<string, number>, key: string): number {
  return clamp(blendshapeMap[key] ?? 0, 0, 1)
}

function baselineValue(baseline: NeutralBaseline | null, key: string): number {
  return clamp(baseline?.perShape?.[key] ?? 0, 0, 1)
}

function computeConfidence(hasFace: boolean, fps: number, headJitter: number): number {
  if (!hasFace) return 0

  const fpsFactor = clamp(fps / 24, 0, 1)
  const jitterPenalty = clamp(headJitter / 0.04, 0, 1)
  const confidence = 0.45 + 0.4 * fpsFactor + 0.15 * (1 - jitterPenalty)
  return clamp(Number(confidence.toFixed(2)), 0, 1)
}

export function computeStressMood(input: StressScoringInput): StressScoringResult {
  if (!input.hasFace) {
    return {
      stressScore: 0,
      moodLabel: 'Neutral',
      confidence: 0,
      emaStress: input.previousEmaStress * 0.85,
      eyeBlink: 0,
      tensionSignal: 0,
    }
  }

  const eyeBlink = avg([shapeValue(input.blendshapeMap, 'eyeBlinkLeft'), shapeValue(input.blendshapeMap, 'eyeBlinkRight')])
  const browDown = avg([shapeValue(input.blendshapeMap, 'browDownLeft'), shapeValue(input.blendshapeMap, 'browDownRight')])
  const mouthPress = avg([shapeValue(input.blendshapeMap, 'mouthPressLeft'), shapeValue(input.blendshapeMap, 'mouthPressRight')])

  let weightedDelta = 0
  let weightSum = 0
  Object.entries(STRESS_WEIGHTS).forEach(([key, weight]) => {
    const current = shapeValue(input.blendshapeMap, key)
    const baseline = baselineValue(input.baseline, key)
    const delta = Math.max(0, current - baseline)
    weightedDelta += delta * weight
    weightSum += weight
  })

  const tensionSignal = weightSum > 0 ? weightedDelta / weightSum : 0
  const rawStress = clamp(tensionSignal * 180, 0, 100)
  const emaStress = clamp(
    input.previousEmaStress + EMA_ALPHA * (rawStress - input.previousEmaStress),
    0,
    100,
  )
  const stressScore = Math.round(emaStress)

  const focused = stressScore >= 20 && stressScore <= 45 && eyeBlink < 0.24 && input.headJitter < 0.012
  const browDownHigh = browDown - avg([baselineValue(input.baseline, 'browDownLeft'), baselineValue(input.baseline, 'browDownRight')]) > 0.18
  const mouthPressHigh = mouthPress - avg([baselineValue(input.baseline, 'mouthPressLeft'), baselineValue(input.baseline, 'mouthPressRight')]) > 0.16

  let moodLabel: MoodLabel = 'Neutral'
  if (stressScore < 20) {
    moodLabel = 'Calm'
  } else if (focused) {
    moodLabel = 'Focused'
  } else if (stressScore > 70 && browDownHigh && mouthPressHigh) {
    moodLabel = 'Frustrated'
  } else if (stressScore >= 45) {
    moodLabel = 'Stressed'
  }

  return {
    stressScore,
    moodLabel,
    confidence: computeConfidence(input.hasFace, input.fps, input.headJitter),
    emaStress,
    eyeBlink,
    tensionSignal,
  }
}
