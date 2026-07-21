import { Link } from 'react-router-dom'
import { useAdaptation } from '../components/AdaptationProvider.tsx'

export function HomePage() {
  const { preferences } = useAdaptation()

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-300">User-controlled adaptation</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-slate-100 md:text-4xl">Shape the interface around how you prefer to work.</h1>
        <p className="adapt-secondary mt-4 max-w-3xl text-slate-300">
          Neutro turns explicit presentation preferences into deterministic typography, contrast, motion, sensory-load, layout, and focus changes. Nothing is inferred about you.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/adapt" className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">Open adaptation studio</Link>
          <span className="rounded-full border border-border px-3 py-1.5 text-xs text-slate-300">Active: {preferences.profile.replace('-', ' ')}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Core capabilities">
        <article className="rounded-xl border border-border bg-slate-900/60 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">Choose</p>
          <h2 className="mt-2 text-lg font-semibold">Start with a profile</h2>
          <p className="adapt-secondary mt-2 text-sm text-slate-400">Balanced, reading focus, and low stimulation are transparent starting points.</p>
        </article>
        <article className="rounded-xl border border-border bg-slate-900/60 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">Tune</p>
          <h2 className="mt-2 text-lg font-semibold">Override any setting</h2>
          <p className="adapt-secondary mt-2 text-sm text-slate-400">Every manual change becomes a custom profile that remains under your control.</p>
        </article>
        <article className="rounded-xl border border-border bg-slate-900/60 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">Understand</p>
          <h2 className="mt-2 text-lg font-semibold">See why it changed</h2>
          <p className="adapt-secondary mt-2 text-sm text-slate-400">A live preview and explanation list connect each setting to its visible effect.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Optional local tools</h2>
        <p className="adapt-secondary mt-2 text-sm text-slate-300">Reading utilities, session replay, and a camera experiment remain separate labs. They are not required for adaptation and do not change preferences automatically.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/reading" className="rounded-lg border border-amber-300/50 px-3 py-2 text-amber-100 hover:bg-amber-500/10">Reading workspace</Link>
          <Link to="/replay" className="rounded-lg border border-indigo-300/50 px-3 py-2 text-indigo-100 hover:bg-indigo-500/10">Local replay</Link>
          <Link to="/demo/mood-motion" className="rounded-lg border border-cyan-300/50 px-3 py-2 text-cyan-100 hover:bg-cyan-500/10">Camera signal lab</Link>
        </div>
      </section>
    </div>
  )
}
