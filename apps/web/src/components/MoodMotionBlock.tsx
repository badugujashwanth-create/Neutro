import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { VideoCanvas } from './VideoCanvas.tsx'
import { StressInterventionOverlay } from './StressInterventionOverlay.tsx'
import {
  calibrationProgress,
  collectCalibrationSample,
  finalizeCalibration,
  isCalibrationComplete,
  loadNeutralBaseline,
  saveNeutralBaseline,
  startNeutralCalibration,
  type CalibrationSession,
  type NeutralBaseline,
} from '../lib/vision/calibration.ts'
import { computeStressMood, type MoodLabel } from '../lib/vision/scoring.ts'
import { createMotionState, estimateHeadPose, updateMotionState, type MotionLabel } from '../lib/vision/motion.ts'
import { moodFaceLandmarker, startCameraStream, type CameraErrorInfo, type FaceFrameResult } from '../lib/vision/faceLandmarker.ts'
import { useReplay } from './ReplayProvider.tsx'

const STRESS_SPIKE_MS = 5000
const MOTION_SPIKE_MS = 5000
const LABEL_HOLD_MS = 900
const HIGH_STRESS_MARKER_THRESHOLD = 70
const INTERVENTION_ENTER_THRESHOLD = 72
const INTERVENTION_ENTER_MS = 1500
const INTERVENTION_EXIT_THRESHOLD = 45
const INTERVENTION_EXIT_MS = 10_000
const CALM_TONE_GAIN = 0.03

interface ToneEngine {
  context: AudioContext
  oscillator: OscillatorNode
  gain: GainNode
}

interface InterventionState {
  active: boolean
  startedAt: number | null
  reason: string
  audioActive: boolean
  audioBlocked: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolveCameraError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as CameraErrorInfo).message
  }
  return 'Unable to access webcam. Please retry.'
}

function moodColor(label: MoodLabel): string {
  if (label === 'Calm') return 'text-emerald-300'
  if (label === 'Focused') return 'text-cyan-300'
  if (label === 'Stressed') return 'text-amber-300'
  if (label === 'Frustrated') return 'text-rose-300'
  return 'text-slate-100'
}

function motionColor(label: MotionLabel): string {
  if (label === 'Still') return 'text-emerald-300'
  if (label === 'Mild movement') return 'text-cyan-300'
  return 'text-amber-300'
}

export function MoodMotionBlock() {
  const { addMarker, isRecording } = useReplay()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const calibrationRef = useRef<CalibrationSession | null>(null)
  const motionStateRef = useRef(createMotionState())
  const emaStressRef = useRef(0)
  const prevNoseRef = useRef<NormalizedLandmark | null>(null)
  const stressBoostUntilRef = useRef(0)
  const motionBoostUntilRef = useRef(0)
  const candidateMoodRef = useRef<{ label: MoodLabel; since: number } | null>(null)
  const stableMoodRef = useRef<MoodLabel>('Neutral')
  const highStressLatchedRef = useRef(false)
  const restlessLatchedRef = useRef(false)
  const highStressSinceRef = useRef<number | null>(null)
  const lowStressSinceRef = useRef<number | null>(null)
  const interventionActiveRef = useRef(false)
  const toneEngineRef = useRef<ToneEngine | null>(null)
  const audioBlockedMarkerLatchedRef = useRef(false)

  const [running, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<NeutralBaseline | null>(() => loadNeutralBaseline())
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationPct, setCalibrationPct] = useState(0)

  const [faceDetected, setFaceDetected] = useState(false)
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null)
  const [fps, setFps] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [stressScore, setStressScore] = useState(0)
  const [moodLabel, setMoodLabel] = useState<MoodLabel>('Neutral')
  const [motionScore, setMotionScore] = useState(0)
  const [motionLabel, setMotionLabel] = useState<MotionLabel>('Still')
  const [nods, setNods] = useState(0)
  const [shakes, setShakes] = useState(0)
  const [stressSpike, setStressSpike] = useState(false)
  const [motionSpike, setMotionSpike] = useState(false)
  const [intervention, setIntervention] = useState<InterventionState>({
    active: false,
    startedAt: null,
    reason: '',
    audioActive: false,
    audioBlocked: false,
  })

  const baselineReady = Boolean(baseline && baseline.sampleCount > 0)

  const createToneEngine = useCallback((): ToneEngine | null => {
    if (toneEngineRef.current) {
      return toneEngineRef.current
    }

    const audioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!audioCtor) {
      return null
    }

    const context = new audioCtor()
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = 432
    const gain = context.createGain()
    gain.gain.value = CALM_TONE_GAIN
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()

    toneEngineRef.current = { context, oscillator, gain }
    return toneEngineRef.current
  }, [])

  const stopToneEngine = useCallback(async () => {
    const engine = toneEngineRef.current
    toneEngineRef.current = null
    if (!engine) return

    try {
      engine.oscillator.stop()
    } catch {
      // no-op: oscillator may already be stopped
    }
    engine.oscillator.disconnect()
    engine.gain.disconnect()
    try {
      await engine.context.close()
    } catch {
      // no-op: context may already be closed
    }
  }, [])

  const tryStartCalmTone = useCallback(async () => {
    const engine = createToneEngine()
    if (!engine) {
      setIntervention((previous) =>
        previous.active ? { ...previous, audioActive: false, audioBlocked: true } : previous,
      )
      return false
    }

    try {
      if (engine.context.state !== 'running') {
        await engine.context.resume()
      }
    } catch {
      // no-op: handled by state check below
    }

    const running = engine.context.state === 'running'
    setIntervention((previous) =>
      previous.active ? { ...previous, audioActive: running, audioBlocked: !running } : previous,
    )

    if (!running) {
      if (!audioBlockedMarkerLatchedRef.current && isRecording) {
        addMarker('432Hz Audio Blocked', 'intervention')
        audioBlockedMarkerLatchedRef.current = true
      }
    } else {
      audioBlockedMarkerLatchedRef.current = false
    }

    return running
  }, [addMarker, createToneEngine, isRecording])

  const stopIntervention = useCallback(
    (reason: string, emitMarker = true) => {
      if (!interventionActiveRef.current) return
      interventionActiveRef.current = false
      highStressSinceRef.current = null
      lowStressSinceRef.current = null
      audioBlockedMarkerLatchedRef.current = false
      setIntervention({
        active: false,
        startedAt: null,
        reason,
        audioActive: false,
        audioBlocked: false,
      })
      if (emitMarker && isRecording) {
        addMarker('Intervention OFF', 'intervention')
      }
      void stopToneEngine()
    },
    [addMarker, isRecording, stopToneEngine],
  )

  const startIntervention = useCallback(
    (reason: string) => {
      if (interventionActiveRef.current) return
      interventionActiveRef.current = true
      highStressSinceRef.current = null
      lowStressSinceRef.current = null
      setIntervention({
        active: true,
        startedAt: Date.now(),
        reason,
        audioActive: false,
        audioBlocked: false,
      })
      if (isRecording) {
        addMarker('Intervention ON', 'intervention')
      }
      void tryStartCalmTone()
    },
    [addMarker, isRecording, tryStartCalmTone],
  )

  const stopCamera = useCallback(() => {
    moodFaceLandmarker.stop()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setRunning(false)
    setFaceDetected(false)
    setLandmarks(null)
    setFps(0)
    setConfidence(0)
    setInferenceMs(0)
    setStressScore(0)
    setMoodLabel('Neutral')
    setMotionScore(0)
    setMotionLabel('Still')
    setNods(0)
    setShakes(0)
    setCalibrating(false)
    setCalibrationPct(0)
    calibrationRef.current = null
    motionStateRef.current = createMotionState()
    emaStressRef.current = 0
    prevNoseRef.current = null
    candidateMoodRef.current = null
    stableMoodRef.current = 'Neutral'
    highStressLatchedRef.current = false
    restlessLatchedRef.current = false
    highStressSinceRef.current = null
    lowStressSinceRef.current = null
    if (interventionActiveRef.current) {
      stopIntervention('Camera stopped')
    } else {
      void stopToneEngine()
    }
  }, [stopIntervention, stopToneEngine])

  const handleFrame = useCallback(
    (frame: FaceFrameResult) => {
      const pose = estimateHeadPose(frame.landmarks)

      if (calibrationRef.current && frame.hasFace) {
        collectCalibrationSample(calibrationRef.current, frame.blendshapeMap, pose)
        const progress = calibrationProgress(calibrationRef.current)
        setCalibrationPct(progress * 100)

        if (isCalibrationComplete(calibrationRef.current)) {
          const finalized = finalizeCalibration(calibrationRef.current)
          saveNeutralBaseline(finalized)
          setBaseline(finalized)
          calibrationRef.current = null
          setCalibrating(false)
          setCalibrationPct(100)
          if (isRecording) {
            addMarker('Mood/Motion Calibrated', 'system')
          }
        }
      }

      const nose = frame.landmarks?.[1] ?? null
      const previousNose = prevNoseRef.current
      const headJitter = previousNose && nose ? Math.sqrt((nose.x - previousNose.x) ** 2 + (nose.y - previousNose.y) ** 2) : 0
      prevNoseRef.current = nose

      const stress = computeStressMood({
        hasFace: frame.hasFace,
        blendshapeMap: frame.blendshapeMap,
        baseline,
        headJitter,
        fps: frame.fps,
        previousEmaStress: emaStressRef.current,
      })
      emaStressRef.current = stress.emaStress

      const baselinePose = {
        pitch: baseline?.headPitchAvg ?? 0,
        yaw: baseline?.headYawAvg ?? 0,
      }
      const motion = updateMotionState(motionStateRef.current, pose, baselinePose, frame.timestamp)

      const boostedStress = clamp(
        stress.stressScore + (Date.now() < stressBoostUntilRef.current ? 30 : 0),
        0,
        100,
      )
      const boostedMotion = clamp(
        motion.jitterScore + (Date.now() < motionBoostUntilRef.current ? 35 : 0),
        0,
        100,
      )

      const now = Date.now()
      const rawMood = stress.moodLabel
      if (!candidateMoodRef.current || candidateMoodRef.current.label !== rawMood) {
        candidateMoodRef.current = { label: rawMood, since: now }
      } else if (now - candidateMoodRef.current.since >= LABEL_HOLD_MS) {
        stableMoodRef.current = rawMood
      }
      const stableMood = stableMoodRef.current

      if (boostedStress >= HIGH_STRESS_MARKER_THRESHOLD && !highStressLatchedRef.current) {
        highStressLatchedRef.current = true
        if (isRecording) {
          addMarker('Stress High', 'stress')
        }
      }
      if (boostedStress < HIGH_STRESS_MARKER_THRESHOLD - 8) {
        highStressLatchedRef.current = false
      }

      if (motion.motionLabel === 'Restless' && !restlessLatchedRef.current) {
        restlessLatchedRef.current = true
        if (isRecording) {
          addMarker('Motion Restless', 'motion')
        }
      }
      if (motion.motionLabel !== 'Restless' && boostedMotion < 48) {
        restlessLatchedRef.current = false
      }

      if (boostedStress >= INTERVENTION_ENTER_THRESHOLD) {
        if (highStressSinceRef.current === null) {
          highStressSinceRef.current = now
        }
      } else {
        highStressSinceRef.current = null
      }

      if (boostedStress <= INTERVENTION_EXIT_THRESHOLD) {
        if (lowStressSinceRef.current === null) {
          lowStressSinceRef.current = now
        }
      } else {
        lowStressSinceRef.current = null
      }

      if (
        !interventionActiveRef.current &&
        highStressSinceRef.current !== null &&
        now - highStressSinceRef.current >= INTERVENTION_ENTER_MS
      ) {
        startIntervention('Stress sustained above threshold')
      }

      if (
        interventionActiveRef.current &&
        lowStressSinceRef.current !== null &&
        now - lowStressSinceRef.current >= INTERVENTION_EXIT_MS
      ) {
        stopIntervention('Stress recovered')
      }

      setFaceDetected(frame.hasFace)
      setLandmarks(frame.landmarks)
      setFps(frame.fps)
      setConfidence(stress.confidence)
      setInferenceMs(frame.inferenceMs)
      setStressScore(boostedStress)
      setMoodLabel(stableMood)
      setMotionScore(boostedMotion)
      setMotionLabel(
        boostedMotion >= 56 ? 'Restless' : boostedMotion >= 20 ? 'Mild movement' : 'Still',
      )
      setNods(motion.nodCount)
      setShakes(motion.shakeCount)
    },
    [addMarker, baseline, isRecording, startIntervention, stopIntervention],
  )

  useEffect(() => {
    const unlisten = moodFaceLandmarker.onResults(handleFrame)
    return () => {
      unlisten()
    }
  }, [handleFrame])

  useEffect(() => {
    return () => {
      stopIntervention('Component unmounted', false)
      stopCamera()
    }
  }, [stopCamera, stopIntervention])

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return
    setErrorMessage(null)

    try {
      const stream = await startCameraStream(videoRef.current)
      streamRef.current = stream
      await moodFaceLandmarker.start(videoRef.current)
      setRunning(true)
      if (isRecording) {
        addMarker('Mood/Motion Camera ON', 'system')
      }
    } catch (error) {
      setErrorMessage(resolveCameraError(error))
      stopCamera()
    }
  }, [addMarker, isRecording, stopCamera])

  const startCalibration = () => {
    if (!running) {
      setErrorMessage('Start camera before neutral calibration.')
      return
    }
    calibrationRef.current = startNeutralCalibration(10_000)
    setCalibrating(true)
    setCalibrationPct(0)
  }

  const triggerStressSpike = () => {
    stressBoostUntilRef.current = Date.now() + STRESS_SPIKE_MS
    setStressSpike(true)
    window.setTimeout(() => setStressSpike(false), STRESS_SPIKE_MS + 120)
  }

  const triggerMotionSpike = () => {
    motionBoostUntilRef.current = Date.now() + MOTION_SPIKE_MS
    setMotionSpike(true)
    window.setTimeout(() => setMotionSpike(false), MOTION_SPIKE_MS + 120)
  }

  const confidenceText = useMemo(() => `${Math.round(confidence * 100)}%`, [confidence])

  return (
    <>
      <section className="rounded-2xl border border-border bg-panel/85 p-5 shadow-xl shadow-black/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-100">Mood &amp; Motion Detector</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              On-device processing
            </span>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${running ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-700 text-slate-300'}`}>
              Camera {running ? 'ON' : 'OFF'}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                intervention.active ? 'bg-rose-500/20 text-rose-100' : 'bg-slate-700 text-slate-300'
              }`}
            >
              Calming {intervention.active ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-3">
            <VideoCanvas videoRef={videoRef} landmarks={landmarks} running={running} />
            {!faceDetected && running && (
              <p className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                No face detected. Keep your face centered and well-lit.
              </p>
            )}
            {errorMessage && (
              <p className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{errorMessage}</p>
            )}
            <p className="text-xs text-slate-400">
              Stress is a non-medical estimate from facial tension. Motion score reflects head/face movement
              intensity.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Mood</p>
              <p className={`mt-1 text-3xl font-bold ${moodColor(moodLabel)}`}>{moodLabel}</p>
            </div>

            <div className="rounded-xl border border-border bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-400">Stress Meter</p>
                <p className="text-sm font-semibold text-slate-100">{stressScore}/100</p>
              </div>
              <div className="mt-2 h-3 rounded-full bg-slate-800">
                <div
                  className={`h-3 rounded-full transition-all ${
                    stressScore < 20 ? 'bg-emerald-400' : stressScore < 45 ? 'bg-cyan-400' : stressScore < 70 ? 'bg-amber-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${stressScore}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-400">Motion</p>
                <p className={`text-sm font-semibold ${motionColor(motionLabel)}`}>{motionLabel}</p>
              </div>
              <div className="mt-2 h-3 rounded-full bg-slate-800">
                <div
                  className={`h-3 rounded-full transition-all ${motionScore < 20 ? 'bg-emerald-400' : motionScore < 56 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                  style={{ width: `${motionScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">Nods: {nods} | Shakes: {shakes}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{confidenceText}</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">FPS</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{fps.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Inference</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{inferenceMs.toFixed(1)}ms</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Calibrated</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{baselineReady ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {calibrating && (
              <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Calibrating Neutral (10s)</p>
                <div className="mt-2 h-2 rounded-full bg-cyan-950/70">
                  <div className="h-2 rounded-full bg-cyan-400 transition-all" style={{ width: `${clamp(calibrationPct, 0, 100)}%` }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void startCamera()}
                disabled={running}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Camera
              </button>
              <button
                onClick={stopCamera}
                className="rounded-lg border border-rose-300/50 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/20"
              >
                Stop Camera
              </button>
              <button
                onClick={startCalibration}
                disabled={!running || calibrating}
                className="rounded-lg border border-cyan-300/50 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Calibrate Neutral
              </button>
              <button
                onClick={triggerStressSpike}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  stressSpike ? 'border-rose-200/60 bg-rose-500/20 text-rose-100' : 'border-rose-300/50 text-rose-100 hover:bg-rose-500/20'
                }`}
              >
                {stressSpike ? 'Stress Spike Active' : 'Simulate Stress +30'}
              </button>
              <button
                onClick={triggerMotionSpike}
                className={`col-span-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  motionSpike ? 'border-amber-200/60 bg-amber-500/20 text-amber-100' : 'border-amber-300/50 text-amber-100 hover:bg-amber-500/20'
                }`}
              >
                {motionSpike ? 'Motion Jitter Active' : 'Simulate Motion Jitter'}
              </button>
            </div>

            {intervention.active && (
              <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                Calming mode running. {intervention.reason}
              </p>
            )}
          </div>
        </div>
      </section>

      <StressInterventionOverlay
        active={intervention.active}
        stressScore={stressScore}
        audioState={{ active: intervention.audioActive, blocked: intervention.audioBlocked }}
        onStop={() => stopIntervention('Stopped manually')}
        onRetryAudio={() => {
          void tryStartCalmTone()
        }}
      />
    </>
  )
}
