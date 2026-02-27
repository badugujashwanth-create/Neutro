import { Link } from 'react-router-dom'
import { useReplay } from '../components/ReplayProvider.tsx'

export function HomePage() {
  const { isRecording, sessions } = useReplay()

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Demo Dashboard</h1>
        <p className="mt-2 text-sm text-slate-300">
          This build keeps only three modules: global Session Replay, Mood + Motion Detector, and Reading Mode with file import.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link to="/replay" className="rounded-xl border border-border bg-slate-900/60 p-4 hover:border-indigo-300/60">
          <p className="text-sm uppercase tracking-wide text-slate-400">Replay</p>
          <p className="mt-1 text-lg font-semibold">Sessions: {sessions.length}</p>
          <p className="mt-2 text-xs text-slate-400">Record full-app journeys and replay with markers.</p>
        </Link>

        <Link to="/demo/mood-motion" className="rounded-xl border border-border bg-slate-900/60 p-4 hover:border-cyan-300/60">
          <p className="text-sm uppercase tracking-wide text-slate-400">Mood + Motion</p>
          <p className="mt-1 text-lg font-semibold">Live Face Detector</p>
          <p className="mt-2 text-xs text-slate-400">Stress proxy + movement intensity + nod/shake activity.</p>
        </Link>

        <Link to="/reading" className="rounded-xl border border-border bg-slate-900/60 p-4 hover:border-amber-300/60">
          <p className="text-sm uppercase tracking-wide text-slate-400">Reading Mode</p>
          <p className="mt-1 text-lg font-semibold">PDF / DOCX / TXT</p>
          <p className="mt-2 text-xs text-slate-400">Upload docs and apply ruler, bionic rendering, and TTS.</p>
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <p className="text-sm text-slate-300">
          Recorder status:
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${isRecording ? 'bg-rose-500/20 text-rose-200' : 'bg-slate-700 text-slate-300'}`}>
            {isRecording ? 'Recording' : 'Stopped'}
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Start replay from the top bar, move across routes, then stop and open the Replay page.
        </p>
      </section>
    </div>
  )
}
