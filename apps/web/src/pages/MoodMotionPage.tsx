import { MoodMotionBlock } from '../components/MoodMotionBlock.tsx'

export function MoodMotionPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Experimental Camera Signal Lab</h1>
        <p className="mt-2 text-sm text-slate-300">
          An optional, on-device prototype that maps face-landmark and movement signals to unvalidated interface labels. It is not emotion recognition, diagnosis, or health advice, and it never changes adaptation preferences.
        </p>
      </section>

      <MoodMotionBlock />
    </div>
  )
}
