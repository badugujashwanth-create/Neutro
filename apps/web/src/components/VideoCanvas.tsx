import { useEffect, useRef } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { RefObject } from 'react'

interface VideoCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>
  landmarks: NormalizedLandmark[] | null
  running: boolean
}

const OUTLINE_INDEXES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127]

export function VideoCanvas({ videoRef, landmarks, running }: VideoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const videoEl = videoRef.current
    const canvasEl = canvasRef.current
    if (!videoEl || !canvasEl) return

    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const width = videoEl.videoWidth || videoEl.clientWidth || 640
    const height = videoEl.videoHeight || videoEl.clientHeight || 360

    if (canvasEl.width !== width || canvasEl.height !== height) {
      canvasEl.width = width
      canvasEl.height = height
    }

    ctx.clearRect(0, 0, width, height)
    if (!running || !landmarks || landmarks.length === 0) return

    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
    ctx.beginPath()
    OUTLINE_INDEXES.forEach((index, idx) => {
      const point = landmarks[index]
      if (!point) return
      const x = point.x * width
      const y = point.y * height
      if (idx === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.closePath()
    ctx.stroke()

    ctx.fillStyle = 'rgba(34, 211, 238, 0.85)'
    landmarks.forEach((point, index) => {
      if (index % 18 !== 0) return
      const x = point.x * width
      const y = point.y * height
      ctx.beginPath()
      ctx.arc(x, y, 1.8, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [landmarks, running, videoRef])

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950/80">
      <video ref={videoRef} className="block w-full max-h-[360px] object-cover" autoPlay muted playsInline />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  )
}
