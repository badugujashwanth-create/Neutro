import { useEffect, useState } from 'react'
import { clearReplayBundles } from '../lib/replay/storage.ts'
import { useReplay } from '../components/ReplayProvider.tsx'
import { Link } from 'react-router-dom'
import { useAdaptation } from '../components/AdaptationProvider.tsx'

export function SettingsPage() {
  const { refreshSessions } = useReplay()
  const { preferences, systemReducedMotion } = useAdaptation()
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const clearAllReplays = async () => {
    await clearReplayBundles()
    await refreshSessions()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-300">Local data and environment status.</p>
      </section>

      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Accessibility</h2>
        <p className="mt-2 text-sm text-slate-300">
          Operating-system reduced motion detected:
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${reducedMotion ? 'bg-amber-500/20 text-amber-100' : 'bg-slate-700 text-slate-300'}`}>
            {reducedMotion ? 'ON' : 'OFF'}
          </span>
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Adaptation</h2>
        <p className="mt-2 text-sm text-slate-300">Current profile: <span className="font-semibold text-indigo-200">{preferences.profile.replace('-', ' ')}</span>. Effective reduced motion: {preferences.motion === 'reduced' || systemReducedMotion ? 'on' : 'off'}.</p>
        <Link to="/adapt" className="mt-3 inline-block rounded-md border border-indigo-300/60 px-3 py-1.5 text-sm text-indigo-100 hover:bg-indigo-500/20">Manage presentation preferences</Link>
      </section>

      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Replay Data</h2>
        <p className="mt-2 text-sm text-slate-300">Delete all locally stored replay sessions and markers.</p>
        <button
          onClick={() => void clearAllReplays()}
          className="mt-3 rounded-md border border-rose-300/60 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/20"
        >
          Clear Replay Storage
        </button>
      </section>
    </div>
  )
}
