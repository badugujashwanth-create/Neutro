import { useEffect, useMemo, useRef, useState } from 'react'
import { Replayer } from 'rrweb'
import { useReplay } from '../components/ReplayProvider.tsx'
import { clearReplayBundles, deleteReplayBundle } from '../lib/replay/storage.ts'
import type { ReplayBundle, ReplayMarker } from '../types/replay.ts'

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function markerColor(marker: ReplayMarker): string {
  if (marker.kind === 'stress') return 'bg-rose-400'
  if (marker.kind === 'motion') return 'bg-cyan-400'
  if (marker.kind === 'reading') return 'bg-amber-400'
  if (marker.kind === 'tts') return 'bg-emerald-400'
  if (marker.kind === 'intervention') return 'bg-fuchsia-400'
  return 'bg-indigo-400'
}

export function ReplayPage() {
  const { sessions, refreshSessions } = useReplay()
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [speed, setSpeed] = useState(1)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const replayerRef = useRef<Replayer | null>(null)

  const resolvedSessionId = sessions.some((session) => session.id === selectedSessionId)
    ? selectedSessionId
    : sessions[0]?.id ?? ''

  const selectedSession = useMemo<ReplayBundle | null>(
    () => sessions.find((session) => session.id === resolvedSessionId) ?? null,
    [resolvedSessionId, sessions],
  )

  const durationMs = selectedSession?.durationMs ?? 0

  useEffect(() => {
    if (!containerRef.current || !selectedSession) return

    containerRef.current.innerHTML = ''
    const replayer = new Replayer(selectedSession.events, {
      root: containerRef.current,
      speed: 1,
      skipInactive: true,
    })
    replayerRef.current = replayer

    return () => {
      replayer.pause()
      replayer.destroy()
      replayerRef.current = null
    }
  }, [selectedSession])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!replayerRef.current) return
      const next = clamp(replayerRef.current.getCurrentTime(), 0, durationMs)
      setCurrentMs(next)
      if (isPlaying && next >= durationMs && durationMs > 0) {
        setIsPlaying(false)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [durationMs, isPlaying])

  const togglePlayback = () => {
    if (!replayerRef.current || !selectedSession) return
    if (isPlaying) {
      replayerRef.current.pause()
      setCurrentMs(clamp(replayerRef.current.getCurrentTime(), 0, durationMs))
      setIsPlaying(false)
      return
    }
    const fromMs = currentMs >= durationMs ? 0 : currentMs
    replayerRef.current.play(fromMs)
    setIsPlaying(true)
  }

  const onScrub = (targetMs: number) => {
    if (!replayerRef.current) return
    const clamped = clamp(targetMs, 0, durationMs)
    setCurrentMs(clamped)
    if (isPlaying) {
      replayerRef.current.play(clamped)
    } else {
      replayerRef.current.pause(clamped)
    }
  }

  const onDeleteSession = async (id: string) => {
    await deleteReplayBundle(id)
    if (id === resolvedSessionId) {
      setSelectedSessionId('')
      setCurrentMs(0)
      setIsPlaying(false)
      setSpeed(1)
    }
    await refreshSessions()
  }

  const onClearAll = async () => {
    await clearReplayBundles()
    setSelectedSessionId('')
    setCurrentMs(0)
    setIsPlaying(false)
    setSpeed(1)
    await refreshSessions()
  }

  const onSelectSession = (id: string) => {
    setSelectedSessionId(id)
    setCurrentMs(0)
    setIsPlaying(false)
    setSpeed(1)
  }

  const onSpeedChange = (value: number) => {
    setSpeed(value)
    replayerRef.current?.setConfig({ speed: value })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Replay Sessions</h1>
            <p className="mt-1 text-sm text-slate-300">Play and scrub recorded journeys across the full application.</p>
          </div>
          <button
            onClick={() => void onClearAll()}
            disabled={sessions.length === 0}
            className="rounded-md border border-rose-300/60 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear all sessions
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="rounded-2xl border border-border bg-panel/80 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Session List</h2>
          <div className="mt-3 space-y-2">
            {sessions.length === 0 && <p className="text-sm text-slate-400">No sessions yet. Start replay in the top bar.</p>}
            {sessions.map((session) => {
              const selected = session.id === resolvedSessionId
              return (
                <div
                  key={session.id}
                  className={`w-full rounded-lg border px-3 py-3 text-left ${
                    selected ? 'border-indigo-300/60 bg-indigo-500/10' : 'border-border bg-slate-950/30'
                  }`}
                >
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full text-left"
                  >
                  <p className="text-sm font-medium text-slate-100">{new Date(session.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDuration(session.durationMs)} | {session.events.length} events | {session.markers.length} markers
                  </p>
                  </button>
                  <button
                    onClick={() => void onDeleteSession(session.id)}
                    className="mt-2 rounded border border-rose-300/60 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        </aside>

        <div className="space-y-4 rounded-2xl border border-border bg-panel/80 p-4">
          {!selectedSession && <p className="text-sm text-slate-400">Select a session to open player.</p>}

          {selectedSession && (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-slate-950/70 p-2">
                <div ref={containerRef} className="w-full overflow-hidden rounded border border-border bg-white" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={togglePlayback}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                <label className="text-sm text-slate-300">
                  Speed
                  <select
                    value={speed}
                    onChange={(event) => onSpeedChange(Number(event.target.value))}
                    className="ml-2 rounded-md border border-border bg-slate-900 px-2 py-1 text-slate-100"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </label>

                <span className="text-sm text-slate-300">
                  {formatDuration(currentMs)} / {formatDuration(durationMs)}
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, durationMs)}
                  value={clamp(currentMs, 0, Math.max(1, durationMs))}
                  onChange={(event) => onScrub(Number(event.target.value))}
                  className="w-full accent-indigo-400"
                />
                <div className="relative mt-2 h-6 rounded bg-slate-900">
                  {selectedSession.markers.map((marker) => (
                    <button
                      key={marker.id}
                      title={marker.label}
                      onClick={() => onScrub(marker.atMs)}
                      className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${markerColor(marker)} ring-2 ring-slate-950`}
                      style={{ left: `${(clamp(marker.atMs, 0, durationMs) / Math.max(durationMs, 1)) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSession.markers.slice(0, 8).map((marker) => (
                    <span key={`chip-${marker.id}`} className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">
                      {formatDuration(marker.atMs)} - {marker.label}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
