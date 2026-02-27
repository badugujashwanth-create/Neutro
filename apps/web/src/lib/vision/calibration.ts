import { readJson, writeJson } from '../storage/localJson.ts'

const BASELINE_STORAGE_KEY = 'neutro-mood-baseline-v1'

export const TENSION_BLENDSHAPE_KEYS = [
  'browDownLeft',
  'browDownRight',
  'jawClench',
  'mouthPressLeft',
  'mouthPressRight',
  'noseSneerLeft',
  'noseSneerRight',
  'eyeWideLeft',
  'eyeWideRight',
] as const

export type TensionBlendshapeKey = (typeof TENSION_BLENDSHAPE_KEYS)[number]

const AUX_BLENDSHAPE_KEYS = ['eyeBlinkLeft', 'eyeBlinkRight'] as const
const ALL_BASELINE_KEYS = [...TENSION_BLENDSHAPE_KEYS, ...AUX_BLENDSHAPE_KEYS]

export interface NeutralBaseline {
  createdAt: string
  sampleCount: number
  browDownAvg: number
  jawClenchAvg: number
  mouthPressAvg: number
  eyeBlinkAvg: number
  noseSneerAvg: number
  eyeWideAvg: number
  headPitchAvg: number
  headYawAvg: number
  perShape: Record<string, number>
}

export interface CalibrationSession {
  startedAt: number
  durationMs: number
  sampleCount: number
  sums: Record<string, number>
  headPitchSum: number
  headYawSum: number
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function blankShapeRecord(): Record<string, number> {
  const record: Record<string, number> = {}
  ALL_BASELINE_KEYS.forEach((key) => {
    record[key] = 0
  })
  return record
}

function pickBlendshapeScore(blendshapeMap: Record<string, number>, key: string): number {
  return Math.max(0, Math.min(1, blendshapeMap[key] ?? 0))
}

function buildDerivedAverages(perShape: Record<string, number>) {
  const browDownAvg = avg([perShape.browDownLeft ?? 0, perShape.browDownRight ?? 0])
  const mouthPressAvg = avg([perShape.mouthPressLeft ?? 0, perShape.mouthPressRight ?? 0])
  const eyeBlinkAvg = avg([perShape.eyeBlinkLeft ?? 0, perShape.eyeBlinkRight ?? 0])
  const noseSneerAvg = avg([perShape.noseSneerLeft ?? 0, perShape.noseSneerRight ?? 0])
  const eyeWideAvg = avg([perShape.eyeWideLeft ?? 0, perShape.eyeWideRight ?? 0])
  return {
    browDownAvg,
    jawClenchAvg: perShape.jawClench ?? 0,
    mouthPressAvg,
    eyeBlinkAvg,
    noseSneerAvg,
    eyeWideAvg,
  }
}

export function createDefaultBaseline(): NeutralBaseline {
  const perShape = blankShapeRecord()
  return {
    createdAt: new Date().toISOString(),
    sampleCount: 0,
    ...buildDerivedAverages(perShape),
    headPitchAvg: 0,
    headYawAvg: 0,
    perShape,
  }
}

export function loadNeutralBaseline(): NeutralBaseline | null {
  const baseline = readJson<NeutralBaseline | null>(BASELINE_STORAGE_KEY, null)
  if (!baseline || typeof baseline !== 'object') return null
  if (!baseline.perShape || typeof baseline.perShape !== 'object') return null
  return baseline
}

export function saveNeutralBaseline(baseline: NeutralBaseline): void {
  writeJson(BASELINE_STORAGE_KEY, baseline)
}

export function startNeutralCalibration(durationMs = 10_000): CalibrationSession {
  return {
    startedAt: performance.now(),
    durationMs,
    sampleCount: 0,
    sums: blankShapeRecord(),
    headPitchSum: 0,
    headYawSum: 0,
  }
}

export function collectCalibrationSample(
  session: CalibrationSession,
  blendshapeMap: Record<string, number>,
  headPose?: { pitch: number; yaw: number },
): CalibrationSession {
  ALL_BASELINE_KEYS.forEach((key) => {
    session.sums[key] += pickBlendshapeScore(blendshapeMap, key)
  })
  if (headPose) {
    session.headPitchSum += headPose.pitch
    session.headYawSum += headPose.yaw
  }
  session.sampleCount += 1
  return session
}

export function calibrationProgress(session: CalibrationSession, now = performance.now()): number {
  const elapsed = Math.max(0, now - session.startedAt)
  return Math.max(0, Math.min(1, elapsed / session.durationMs))
}

export function isCalibrationComplete(session: CalibrationSession, now = performance.now()): boolean {
  return calibrationProgress(session, now) >= 1
}

export function finalizeCalibration(session: CalibrationSession): NeutralBaseline {
  const safeCount = Math.max(1, session.sampleCount)
  const perShape = blankShapeRecord()
  ALL_BASELINE_KEYS.forEach((key) => {
    perShape[key] = session.sums[key] / safeCount
  })

  return {
    createdAt: new Date().toISOString(),
    sampleCount: session.sampleCount,
    ...buildDerivedAverages(perShape),
    headPitchAvg: session.headPitchSum / safeCount,
    headYawAvg: session.headYawSum / safeCount,
    perShape,
  }
}
