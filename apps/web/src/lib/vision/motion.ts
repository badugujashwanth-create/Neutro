import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type MotionLabel = 'Still' | 'Mild movement' | 'Restless'

export interface PoseSample {
  ts: number
  pitch: number
  yaw: number
}

export interface MotionState {
  samples: PoseSample[]
}

export interface MotionResult {
  pitch: number
  yaw: number
  jitterScore: number
  nodCount: number
  shakeCount: number
  motionLabel: MotionLabel
}

const WINDOW_MS = 2400
const MAX_SAMPLES = 120

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function countTurningPoints(values: number[], amplitudeThreshold: number): number {
  if (values.length < 3) return 0
  let turningPoints = 0

  for (let index = 1; index < values.length - 1; index += 1) {
    const prev = values[index - 1]
    const current = values[index]
    const next = values[index + 1]
    const isPeak = current > prev && current > next
    const isValley = current < prev && current < next
    if (!isPeak && !isValley) continue

    const amplitude = Math.max(Math.abs(current - prev), Math.abs(current - next))
    if (amplitude >= amplitudeThreshold) {
      turningPoints += 1
    }
  }

  return turningPoints
}

export function createMotionState(): MotionState {
  return { samples: [] }
}

export function estimateHeadPose(landmarks: NormalizedLandmark[] | null): { pitch: number; yaw: number } {
  if (!landmarks || landmarks.length < 300) {
    return { pitch: 0, yaw: 0 }
  }

  const nose = landmarks[1]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  if (!nose || !leftEye || !rightEye) {
    return { pitch: 0, yaw: 0 }
  }

  const eyeMidX = (leftEye.x + rightEye.x) / 2
  const eyeMidY = (leftEye.y + rightEye.y) / 2
  const eyeWidth = Math.max(0.01, Math.abs(rightEye.x - leftEye.x))

  const pitch = (nose.y - eyeMidY) / eyeWidth
  const yaw = (nose.x - eyeMidX) / eyeWidth
  return { pitch, yaw }
}

export function updateMotionState(
  state: MotionState,
  pose: { pitch: number; yaw: number },
  baseline: { pitch: number; yaw: number },
  timestamp = Date.now(),
): MotionResult {
  state.samples.push({
    ts: timestamp,
    pitch: pose.pitch - baseline.pitch,
    yaw: pose.yaw - baseline.yaw,
  })

  const cutoff = timestamp - WINDOW_MS
  state.samples = state.samples.filter((sample) => sample.ts >= cutoff).slice(-MAX_SAMPLES)

  const pitchSeries = state.samples.map((sample) => sample.pitch)
  const yawSeries = state.samples.map((sample) => sample.yaw)
  const pitchStd = stdDev(pitchSeries)
  const yawStd = stdDev(yawSeries)

  const nodTurningPoints = countTurningPoints(pitchSeries, 0.015)
  const shakeTurningPoints = countTurningPoints(yawSeries, 0.015)
  const nodCount = Math.floor(nodTurningPoints / 2)
  const shakeCount = Math.floor(shakeTurningPoints / 2)

  const jitterRaw = pitchStd * 170 + yawStd * 170 + nodCount * 7 + shakeCount * 7
  const jitterScore = clamp(Math.round(jitterRaw), 0, 100)

  let motionLabel: MotionLabel = 'Still'
  if (jitterScore >= 56 || nodCount + shakeCount >= 3) {
    motionLabel = 'Restless'
  } else if (jitterScore >= 20) {
    motionLabel = 'Mild movement'
  }

  return {
    pitch: pose.pitch,
    yaw: pose.yaw,
    jitterScore,
    nodCount,
    shakeCount,
    motionLabel,
  }
}
