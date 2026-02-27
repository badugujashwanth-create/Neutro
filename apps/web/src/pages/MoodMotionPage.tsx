import { MoodMotionBlock } from '../components/MoodMotionBlock.tsx'

export function MoodMotionPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Mood + Motion Scan</h1>
        <p className="mt-2 text-sm text-slate-300">
          Local face analysis with mood label, stress proxy, motion intensity, nod/shake counters, and live confidence/FPS.
        </p>
      </section>

      <MoodMotionBlock />
    </div>
  )
}
