import { useEffect, useMemo, useState } from 'react'

interface StressInterventionOverlayProps {
  active: boolean
  stressScore: number
  audioState: {
    active: boolean
    blocked: boolean
  }
  onStop: () => void
  onRetryAudio: () => void
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}

export function StressInterventionOverlay({
  active,
  stressScore,
  audioState,
  onStop,
  onRetryAudio,
}: StressInterventionOverlayProps) {
  if (!active) return null

  return (
    <ActiveStressInterventionOverlay
      stressScore={stressScore}
      audioState={audioState}
      onStop={onStop}
      onRetryAudio={onRetryAudio}
    />
  )
}

function ActiveStressInterventionOverlay({
  stressScore,
  audioState,
  onStop,
  onRetryAudio,
}: Omit<StressInterventionOverlayProps, 'active'>) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 200)
    return () => window.clearInterval(interval)
  }, [])

  const timerText = useMemo(() => formatDuration(elapsedMs), [elapsedMs])

  return (
    <div className="fixed inset-0 z-[120] bg-black/98">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
          User-started pause overlay
        </p>
        <h2 className="text-3xl font-semibold text-slate-100">Pause and reset</h2>
        <p className="text-sm text-slate-300">
          This optional blank screen and tone were started manually. Stop whenever you choose; no medical benefit is claimed.
        </p>

        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Prototype signal</p>
            <p className="mt-1 text-2xl font-semibold text-rose-300">{stressScore}/100</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Duration</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{timerText}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">432Hz</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {audioState.active ? 'Playing' : audioState.blocked ? 'Blocked by browser' : 'Starting...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onStop}
            className="rounded-lg border border-rose-300/60 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/20"
          >
            Stop pause overlay
          </button>
          {audioState.blocked && (
            <button
              onClick={onRetryAudio}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
            >
              Enable Sound
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
