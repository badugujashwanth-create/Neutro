import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Replayer } from 'rrweb'
import { getReplayBundle } from '../lib/replay/storage'
import type { ReplayBundle } from '../types/replay'

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function ReplayPage() {
  const { id } = useParams()
  const [bundle, setBundle] = useState<ReplayBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentMs, setCurrentMs] = useState(0)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const replayerRef = useRef<Replayer | null>(null)

  const durationMs = useMemo(() => bundle?.durationMs ?? 0, [bundle])

  useEffect(() => {
    async function loadBundle() {
      if (!id) return
      setIsLoading(true)
      const replay = await getReplayBundle(id)
      setBundle(replay)
      setIsLoading(false)
    }

    void loadBundle()
  }, [id])

  useEffect(() => {
    if (!bundle || !containerRef.current) return

    containerRef.current.innerHTML = ''
    const replayer = new Replayer(bundle.events, {
      root: containerRef.current,
      speed,
      skipInactive: true,
    })

    replayerRef.current = replayer
    setCurrentMs(0)
    setIsPlaying(false)

    return () => {
      replayer.pause()
      replayer.destroy()
      replayerRef.current = null
    }
  }, [bundle])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!replayerRef.current) return

      const nextTime = clamp(replayerRef.current.getCurrentTime(), 0, durationMs)
      setCurrentMs(nextTime)

      if (isPlaying && nextTime >= durationMs && durationMs > 0) {
        setIsPlaying(false)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [durationMs, isPlaying])

  const togglePlayback = () => {
    if (!replayerRef.current || !bundle) return

    if (isPlaying) {
      replayerRef.current.pause()
      setCurrentMs(clamp(replayerRef.current.getCurrentTime(), 0, durationMs))
      setIsPlaying(false)
      return
    }

    const startAt = currentMs >= durationMs ? 0 : currentMs
    replayerRef.current.play(startAt)
    setCurrentMs(startAt)
    setIsPlaying(true)
  }

  const onScrub = (value: number) => {
    if (!replayerRef.current) return

    const clamped = clamp(value, 0, durationMs)
    setCurrentMs(clamped)

    if (isPlaying) {
      replayerRef.current.play(clamped)
    } else {
      replayerRef.current.pause(clamped)
    }
  }

  const onSpeedChange = (value: number) => {
    setSpeed(value)
    if (!replayerRef.current) return

    replayerRef.current.setConfig({ speed: value })
    if (isPlaying) {
      replayerRef.current.play(currentMs)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading replay...</p>
  }

  if (!bundle) {
    return (
      <div className="rounded-2xl border border-border bg-panel/80 p-6">
        <p className="text-slate-300">Session not found.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-indigo-300 hover:text-indigo-200">
          Back to sessions
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-panel/80 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Replay Session</h1>
            <p className="text-sm text-slate-400">
              {new Date(bundle.createdAt).toLocaleString()} | {formatDuration(durationMs)} | {bundle.events.length} events
            </p>
          </div>
          <Link to="/" className="text-sm text-indigo-300 hover:text-indigo-200">
            Back to sessions
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-slate-950/70 p-4">
        <div ref={containerRef} className="w-full overflow-hidden rounded-lg border border-border bg-white" />
      </div>

      <div className="rounded-2xl border border-border bg-panel/80 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={togglePlayback}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <label className="text-sm text-slate-300">
            Speed:
            <select
              value={speed}
              onChange={(event) => onSpeedChange(Number(event.target.value))}
              className="ml-2 rounded-md border border-border bg-slate-900 px-2 py-1 text-slate-100"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
            </select>
          </label>
          <span className="text-sm text-slate-300">
            {formatDuration(currentMs)} / {formatDuration(durationMs)}
          </span>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            value={clamp(currentMs, 0, Math.max(1, durationMs))}
            onChange={(event) => onScrub(Number(event.target.value))}
            className="w-full accent-indigo-400"
          />
          <div className="relative mt-2 h-5 rounded bg-slate-900">
            {bundle.interventionMarkers?.map((marker) => (
              <div
                key={marker.id}
                title={marker.label}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-amber-400"
                style={{ left: `${(clamp(marker.atMs, 0, durationMs) / Math.max(durationMs, 1)) * 100}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Timeline supports intervention markers if they exist in a saved session bundle.
          </p>
        </div>
      </div>
    </div>
  )
}
