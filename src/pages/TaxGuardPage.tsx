import { Link } from 'react-router-dom'
import { useTaxGuard } from '../components/TaxGuardProvider.tsx'

function statusStyles(status: string): string {
  if (status === 'approved') return 'bg-emerald-500/20 text-emerald-200'
  if (status === 'cancelled') return 'bg-slate-600/70 text-slate-100'
  if (status === 'overridden') return 'bg-rose-500/20 text-rose-100'
  if (status === 'unlocked_pending_decision') return 'bg-indigo-500/20 text-indigo-100'
  if (status === 'remind_later') return 'bg-amber-500/20 text-amber-100'
  return 'bg-amber-500/20 text-amber-100'
}

export function TaxGuardPage() {
  const { entries, memoryList, clearHistory } = useTaxGuard()

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Tax Guard Logs</h1>
            <p className="mt-1 text-sm text-slate-400">History of locked checkout/trial actions and outcomes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/demo/checkout" className="rounded-lg border border-border px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800/60">
              Open Checkout Demo
            </Link>
            <button
              onClick={clearHistory}
              disabled={entries.length === 0}
              className="rounded-lg border border-rose-300/50 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear history
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-panel/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">History</h2>
          <div className="mt-4 space-y-3">
            {entries.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-slate-400">
                No lock events yet. Run the demo checkout and trigger a lock.
              </p>
            )}

            {entries.map((entry) => (
              <article key={entry.id} className="rounded-lg border border-border bg-slate-950/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 break-all text-xs text-slate-400">{entry.url}</p>
                <p className="mt-2 text-sm text-slate-100">{entry.reason || '(No reason saved)'}</p>
                <p className="mt-2 text-xs text-slate-300">
                  Unlock: {new Date(entry.unlockAt).toLocaleString()} | Overload {entry.context.overloadScore} | Attention{' '}
                  {entry.context.attentionStability} | Break {entry.context.minutesSinceLastBreak}m
                </p>
                {entry.outcome && (
                  <p className="mt-1 text-xs text-indigo-200">
                    Outcome: {entry.outcome === 'yes' ? 'Still wanted it' : 'Decided against it'} (
                    {entry.outcomeAt ? new Date(entry.outcomeAt).toLocaleString() : 'n/a'})
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-panel/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Memory (Last 10)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {memoryList.length === 0 && <li>No memory entries yet.</li>}
            {memoryList.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border bg-slate-950/40 p-2">
                <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleDateString()}</p>
                <p className="mt-1">{entry.reason || '(No reason saved)'}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  )
}
