import {
  FaceLandmarker,
  FilesetResolver,
  type Classifications,
  type Matrix,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export interface BlendshapeScore {
  name: string
  score: number
}

export interface FaceFrameResult {
  hasFace: boolean
  blendshapes: BlendshapeScore[]
  blendshapeMap: Record<string, number>
  landmarks: NormalizedLandmark[] | null
  facialTransformationMatrix: Matrix | null
  timestamp: number
  inferenceMs: number
  fps: number
}

export interface CameraErrorInfo {
  code: 'permission_denied' | 'not_found' | 'not_readable' | 'not_supported' | 'unknown'
  message: string
}

export type FaceResultsCallback = (result: FaceFrameResult) => void

function categoriesToMap(classification: Classifications | null): Record<string, number> {
  if (!classification) return {}
  const mapped: Record<string, number> = {}
  classification.categories.forEach((category) => {
    mapped[category.categoryName] = category.score
  })
  return mapped
}

function normalizeCameraError(error: unknown): CameraErrorInfo {
  if (typeof window === 'undefined' || !(error instanceof DOMException)) {
    return {
      code: 'unknown',
      message: 'Unable to access camera.',
    }
  }

  if (error.name === 'NotAllowedError') {
    return {
      code: 'permission_denied',
      message: 'Camera access denied. Please allow webcam permission and retry.',
    }
  }
  if (error.name === 'NotFoundError') {
    return {
      code: 'not_found',
      message: 'No camera device found on this machine.',
    }
  }
  if (error.name === 'NotReadableError') {
    return {
      code: 'not_readable',
      message: 'Camera is currently busy in another app.',
    }
  }

  return {
    code: 'unknown',
    message: 'Could not start webcam. Please retry.',
  }
}

export class FaceLandmarkerEngine {
  private faceLandmarker: FaceLandmarker | null = null
  private callbacks = new Set<FaceResultsCallback>()
  private running = false
  private rafId: number | null = null
  private lastVideoTime = -1
  private lastFrameClock = 0
  private smoothedFps = 0
  private initPromise: Promise<void> | null = null

  private async ensureReady() {
    if (this.faceLandmarker) return
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })
    })()

    await this.initPromise
  }

  onResults(callback: FaceResultsCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  async start(videoEl: HTMLVideoElement): Promise<void> {
    await this.ensureReady()
    if (!this.faceLandmarker || this.running) return

    this.running = true
    this.lastVideoTime = -1
    this.lastFrameClock = performance.now()

    const loop = () => {
      if (!this.running || !this.faceLandmarker) return

      if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.rafId = window.requestAnimationFrame(loop)
        return
      }

      if (videoEl.currentTime === this.lastVideoTime) {
        this.rafId = window.requestAnimationFrame(loop)
        return
      }
      this.lastVideoTime = videoEl.currentTime

      const startedAt = performance.now()
      const result = this.faceLandmarker.detectForVideo(videoEl, startedAt)
      const inferenceMs = performance.now() - startedAt

      const now = performance.now()
      const deltaMs = Math.max(1, now - this.lastFrameClock)
      const instantFps = 1000 / deltaMs
      this.smoothedFps = this.smoothedFps === 0 ? instantFps : this.smoothedFps * 0.85 + instantFps * 0.15
      this.lastFrameClock = now

      const firstLandmarks = result.faceLandmarks?.[0] ?? null
      const firstBlendshape = result.faceBlendshapes?.[0] ?? null
      const hasFace = Boolean(firstLandmarks && firstLandmarks.length > 0)

      const blendshapeMap = categoriesToMap(firstBlendshape)
      const blendshapes = Object.entries(blendshapeMap).map(([name, score]) => ({ name, score }))

      const frameResult: FaceFrameResult = {
        hasFace,
        blendshapes,
        blendshapeMap,
        landmarks: firstLandmarks,
        facialTransformationMatrix: result.facialTransformationMatrixes?.[0] ?? null,
        timestamp: Date.now(),
        inferenceMs: Number(inferenceMs.toFixed(2)),
        fps: Number(this.smoothedFps.toFixed(1)),
      }

      this.callbacks.forEach((callback) => callback(frameResult))
      this.rafId = window.requestAnimationFrame(loop)
    }

    loop()
  }

  stop() {
    this.running = false
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

export async function startCameraStream(videoEl: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw {
      code: 'not_supported',
      message: 'Camera APIs are not supported in this browser.',
    } as CameraErrorInfo
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 960 },
        height: { ideal: 540 },
      },
    })
    videoEl.srcObject = stream
    await videoEl.play()
    return stream
  } catch (error) {
    throw normalizeCameraError(error)
  }
}

export const moodFaceLandmarker = new FaceLandmarkerEngine()
