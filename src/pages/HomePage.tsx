import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/useToast'
import { isReplayRecording, startReplayRecording, stopReplayRecording } from '../lib/replay/recorder'
import { clearReplayBundles, deleteReplayBundle, listReplayBundles, saveReplayBundle } from '../lib/replay/storage'
import type { ReplayBundle } from '../types/replay'

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function HomePage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [recording, setRecording] = useState<boolean>(isReplayRecording())
  const [sessions, setSessions] = useState<ReplayBundle[]>([])
  const [loading, setLoading] = useState(true)

  const [note, setNote] = useState('')

  const latestSession = useMemo(() => sessions[0] ?? null, [sessions])

  const refreshSessions = async () => {
    const bundles = await listReplayBundles()
    setSessions(bundles)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    void listReplayBundles().then((bundles) => {
      if (!active) return
      setSessions(bundles)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const onStart = () => {
    const started = startReplayRecording()
    if (!started) {
      pushToast('Recording is already running')
      return
    }

    setRecording(true)
    pushToast('Recording started')
  }

  const onStop = async () => {
    const bundle = stopReplayRecording()
    setRecording(false)

    if (!bundle) {
      pushToast('No replay data captured')
      return
    }

    await saveReplayBundle(bundle)
    await refreshSessions()
    pushToast('Saved session')
  }

  const onDelete = async (id: string) => {
    await deleteReplayBundle(id)
    await refreshSessions()
    pushToast('Deleted session')
  }

  const onClearAll = async () => {
    await clearReplayBundles()
    await refreshSessions()
    pushToast('Deleted all sessions')
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-panel/80 p-6 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Session Replay</h1>
            <p className="mt-1 text-sm text-slate-400">
              Record in-app clicks, typing, and scrolling. No webcam or audio is captured.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                recording ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/80 text-slate-300'
              }`}
            >
              Recording {recording ? 'ON' : 'OFF'}
            </span>
            <button
              onClick={onStart}
              disabled={recording}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Recording
            </button>
            <button
              onClick={() => void onStop()}
              disabled={!recording}
              className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Stop
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-panel/80 p-6 shadow-lg shadow-black/20">
          <h2 className="text-lg font-semibold text-slate-100">Interaction Surface</h2>
          <p className="mt-1 text-sm text-slate-400">
            Use this area while recording so your session captures clicks, form input, and scrolling.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Quick note</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Type anything to generate input events"
                className="w-full rounded-lg border border-border bg-slate-900/80 px-3 py-2 text-slate-100 outline-none ring-indigo-300 transition focus:ring-2"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button className="rounded-lg border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70">
                Primary Action
              </button>
              <button className="rounded-lg border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70">
                Secondary Action
              </button>
            </div>

            <div className="h-44 overflow-y-auto rounded-lg border border-border bg-slate-900/60 p-3 text-sm text-slate-300">
              {Array.from({ length: 30 }).map((_, index) => (
                <p key={index} className="py-1">
                  Scroll line {index + 1}: This is demo text for scroll event capture.
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel/80 p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Recorded Sessions</h2>
            <div className="flex gap-2">
              <button
                onClick={onClearAll}
                disabled={sessions.length === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear all
              </button>
              <button
                onClick={() => latestSession && navigate(`/replay/${latestSession.id}`)}
                disabled={!latestSession}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Replay last session
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-slate-400">Loading sessions...</p>}

            {!loading && sessions.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-slate-400">
                No sessions saved yet. Start recording, interact with the page, then stop.
              </p>
            )}

            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-border bg-slate-950/30 p-3 transition hover:border-indigo-400/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      Duration: {formatDuration(session.durationMs)} | Events: {session.events.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/replay/${session.id}`}
                      className="rounded-md border border-indigo-400/50 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => void onDelete(session.id)}
                      className="rounded-md border border-red-400/50 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
