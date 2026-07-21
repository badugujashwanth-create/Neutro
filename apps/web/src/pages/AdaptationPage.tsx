import { useAdaptation } from '../components/AdaptationProvider.tsx'
import type {
  AdaptationProfileId,
  ContrastId,
  FontFamilyId,
  MotionId,
  SensoryLoadId,
} from '../types/adaptation.ts'

const profiles: Array<{
  id: Exclude<AdaptationProfileId, 'custom'>
  name: string
  description: string
}> = [
  { id: 'balanced', name: 'Balanced', description: 'Familiar spacing, standard contrast, and system-aware motion.' },
  { id: 'reading-focus', name: 'Reading focus', description: 'Larger readable text, generous spacing, and a simpler content width.' },
  { id: 'low-stimulation', name: 'Low stimulation', description: 'Softer contrast, fewer accents, reduced motion, and simpler layout.' },
]

function outputPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function AdaptationPage() {
  const {
    preferences,
    explanations,
    systemReducedMotion,
    chooseProfile,
    updatePreferences,
    resetPreferences,
  } = useAdaptation()

  return (
    <div className="adaptation-workspace space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-300">Your interface, your choice</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Adaptation studio</h1>
        <p className="adapt-secondary mt-3 max-w-3xl text-sm text-slate-300">
          Choose a starting profile, adjust it manually, and preview every change immediately. Preferences stay only in this browser and never use camera inference.
        </p>
        <p className="mt-3 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          Neutro supports presentation preferences. It does not diagnose, treat, or infer a health condition.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6 rounded-2xl border border-border bg-panel/80 p-6" aria-labelledby="adapt-controls-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="adapt-controls-title" className="text-xl font-semibold text-slate-100">Preferences</h2>
              <p className="adapt-secondary mt-1 text-sm text-slate-400">
                Active profile: <span className="font-semibold text-indigo-200">{preferences.profile.replace('-', ' ')}</span>
              </p>
            </div>
            <button type="button" onClick={resetPreferences} className="rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-100 hover:bg-white/5">
              Reset to balanced
            </button>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-200">Starting profile</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {profiles.map((profile) => {
                const selected = preferences.profile === profile.id
                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseProfile(profile.id)}
                    className={`rounded-xl border p-3 text-left ${selected ? 'border-indigo-300 bg-indigo-500/15' : 'border-border bg-slate-950/30 hover:border-indigo-300/60'}`}
                  >
                    <span className="block text-sm font-semibold text-slate-100">{profile.name}</span>
                    <span className="adapt-secondary mt-1 block text-xs leading-relaxed text-slate-400">{profile.description}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-border pt-5">
            <legend className="px-1 text-sm font-semibold text-slate-200">Typography</legend>
            <label className="block text-sm text-slate-300">
              Typeface
              <select
                value={preferences.fontFamily}
                onChange={(event) => updatePreferences({ fontFamily: event.target.value as FontFamilyId })}
                className="mt-2 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100"
              >
                <option value="system">System</option>
                <option value="readable">Readable</option>
                <option value="mono">Monospaced</option>
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              <span className="flex justify-between"><span>Text size</span><output>{outputPercent(preferences.fontScale)}</output></span>
              <input type="range" min="0.9" max="1.3" step="0.05" value={preferences.fontScale} onChange={(event) => updatePreferences({ fontScale: Number(event.target.value) })} className="mt-2 w-full accent-indigo-400" />
            </label>

            <label className="block text-sm text-slate-300">
              <span className="flex justify-between"><span>Line spacing</span><output>{preferences.lineHeight.toFixed(1)}</output></span>
              <input type="range" min="1.4" max="2" step="0.1" value={preferences.lineHeight} onChange={(event) => updatePreferences({ lineHeight: Number(event.target.value) })} className="mt-2 w-full accent-indigo-400" />
            </label>

            <label className="block text-sm text-slate-300">
              <span className="flex justify-between"><span>Letter spacing</span><output>{preferences.letterSpacing.toFixed(2)}em</output></span>
              <input type="range" min="0" max="0.08" step="0.01" value={preferences.letterSpacing} onChange={(event) => updatePreferences({ letterSpacing: Number(event.target.value) })} className="mt-2 w-full accent-indigo-400" />
            </label>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-slate-200">Presentation</legend>
            <label className="text-sm text-slate-300">
              Contrast
              <select value={preferences.contrast} onChange={(event) => updatePreferences({ contrast: event.target.value as ContrastId })} className="mt-2 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100">
                <option value="standard">Standard</option>
                <option value="high">High</option>
                <option value="soft">Soft</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Motion
              <select value={preferences.motion} onChange={(event) => updatePreferences({ motion: event.target.value as MotionId })} className="mt-2 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100">
                <option value="system">Follow system</option>
                <option value="reduced">Reduce motion</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Sensory load
              <select value={preferences.sensoryLoad} onChange={(event) => updatePreferences({ sensoryLoad: event.target.value as SensoryLoadId })} className="mt-2 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100">
                <option value="standard">Standard</option>
                <option value="low">Low</option>
              </select>
            </label>
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={preferences.simplifiedLayout} onChange={(event) => updatePreferences({ simplifiedLayout: event.target.checked })} className="h-4 w-4 accent-indigo-400" />
                Simplified layout
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={preferences.focusAssistance} onChange={(event) => updatePreferences({ focusAssistance: event.target.checked })} className="h-4 w-4 accent-indigo-400" />
                Focus assistance
              </label>
            </div>
          </fieldset>
        </section>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className="adapt-preview rounded-2xl border border-border bg-panel/80 p-6" aria-labelledby="preview-title">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Live preview</p>
            <h2 id="preview-title" className="mt-2 text-2xl font-semibold text-slate-100">A calmer path through complex work</h2>
            <p className="mt-3 text-slate-300">
              Start with a clear goal. Break the task into one visible step, finish it, and then reveal the next. The interface changes here are deterministic results of your controls.
            </p>
            <div className="adapt-focus-target mt-5 rounded-xl border border-indigo-300/40 bg-indigo-500/10 p-4" tabIndex={0}>
              <p className="text-sm font-semibold text-indigo-100">Current focus</p>
              <p className="adapt-secondary mt-1 text-sm text-slate-300">Review the explanation list, then use Tab to check the visible focus treatment.</p>
            </div>
            <div className="adapt-secondary mt-4 grid grid-cols-2 gap-3 text-center text-xs text-slate-300">
              <span className="rounded-lg border border-border p-3">One primary action</span>
              <span className="rounded-lg border border-border p-3">No automatic inference</span>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-panel/80 p-6" aria-labelledby="why-title">
            <h2 id="why-title" className="text-lg font-semibold text-slate-100">Why the interface changed</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {explanations.map((explanation) => <li key={explanation} className="flex gap-2"><span aria-hidden="true" className="text-indigo-300">•</span><span>{explanation}</span></li>)}
            </ul>
            <p className="mt-4 text-xs text-slate-400">System reduced motion: {systemReducedMotion ? 'requested' : 'not requested'}. Preferences are saved locally on this device.</p>
            <p className="sr-only" aria-live="polite">Active profile {preferences.profile}. {explanations.join(' ')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
