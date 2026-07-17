import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TaxGuardInterceptor } from '../components/TaxGuardInterceptor.tsx'
import { useCognitiveLoad } from '../components/CognitiveLoadProvider.tsx'
import { useTaxGuard } from '../components/TaxGuardProvider.tsx'
import { useToast } from '../components/useToast.ts'

function bandStyles(band: 'green' | 'amber' | 'rose'): string {
  if (band === 'green') return 'bg-emerald-500/20 text-emerald-200'
  if (band === 'amber') return 'bg-amber-500/20 text-amber-100'
  return 'bg-rose-500/20 text-rose-100'
}

export function DemoCheckoutPage() {
  const { pushToast } = useToast()
  const { state, assessment, simulateOverload, setSimulateOverload, updateState, resetBreakTimer } = useCognitiveLoad()
  const { entries, fastForwardLock } = useTaxGuard()
  const [nowMs, setNowMs] = useState(() => Date.now())

  const currentUrl = useMemo(() => window.location.href, [])
  const latestEntry = useMemo(() => entries.find((entry) => entry.url === currentUrl) ?? null, [currentUrl, entries])
  const canFastForward = latestEntry ? Date.parse(latestEntry.unlockAt) > nowMs : false

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const onSubmitPurchase = (event: FormEvent) => {
    event.preventDefault()
    pushToast('Purchase submitted (demo)')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">ADHD Tax Prevention Demo</h1>
            <p className="mt-1 text-sm text-slate-400">
              Route: <code>/demo/checkout</code>. This page mimics transactional UI and runs the Tax Guard interceptor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/tax-guard" className="rounded-lg border border-border px-3 py-1.5 text-slate-200 hover:bg-slate-800/60">
              View Logs
            </Link>
            <button
              onClick={() => setSimulateOverload(!simulateOverload)}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                simulateOverload ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-emerald-500 text-white hover:bg-emerald-400'
              }`}
            >
              Simulate Overload: {simulateOverload ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => {
                if (latestEntry) {
                  fastForwardLock(latestEntry.id)
                  pushToast('Fast-forwarded lock by 24h')
                }
              }}
              disabled={!canFastForward || !latestEntry}
              className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Fast-forward 24h
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <aside className="rounded-2xl border border-border bg-panel/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Cognitive Load State</h2>
          <p className="mt-1 text-sm text-slate-400">Global state pulled by the interceptor for gating decisions.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 font-semibold ${bandStyles(assessment.band)}`}>
              {assessment.band.toUpperCase()}
            </span>
            <span className="rounded-full bg-slate-700/70 px-2 py-1 text-slate-100">Crash risk: {assessment.crashRisk}</span>
            <span className="rounded-full bg-slate-700/70 px-2 py-1 text-slate-100">
              Gate: {assessment.shouldGate ? 'ON' : 'OFF'}
            </span>
          </div>

          {!simulateOverload && (
            <div className="mt-4 space-y-4 text-sm">
              <label className="block">
                <span className="text-slate-300">Overload score: {state.overloadScore}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.overloadScore}
                  onChange={(event) => updateState({ overloadScore: Number(event.target.value) })}
                  className="mt-1 w-full accent-indigo-400"
                />
              </label>
              <label className="block">
                <span className="text-slate-300">Attention stability: {state.attentionStability}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.attentionStability}
                  onChange={(event) => updateState({ attentionStability: Number(event.target.value) })}
                  className="mt-1 w-full accent-indigo-400"
                />
              </label>
              <label className="block">
                <span className="text-slate-300">Minutes since last break: {state.minutesSinceLastBreak}</span>
                <input
                  type="range"
                  min={0}
                  max={240}
                  value={state.minutesSinceLastBreak}
                  onChange={(event) => updateState({ minutesSinceLastBreak: Number(event.target.value) })}
                  className="mt-1 w-full accent-indigo-400"
                />
              </label>
              <button
                onClick={resetBreakTimer}
                className="rounded-md border border-border px-3 py-1.5 text-slate-100 hover:bg-slate-800/60"
              >
                Reset break timer
              </button>
            </div>
          )}

          {simulateOverload && (
            <p className="mt-4 rounded-lg border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100">
              Overload simulation forces high overload, unstable attention, and long time since break.
            </p>
          )}
        </aside>

        <form onSubmit={onSubmitPurchase} className="rounded-2xl border border-border bg-panel/80 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Checkout</h2>
          <p className="mt-1 text-sm text-slate-400">Demo form with card fields and transaction CTA patterns.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-slate-100"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Full name</span>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-slate-100"
                placeholder="Alex Doe"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-300">Card number</span>
              <input
                id="card-number"
                name="billingCardNumber"
                autoComplete="cc-number"
                required
                className="mt-1 w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-slate-100"
                placeholder="4111 1111 1111 1111"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">CVV</span>
              <input
                id="cvv"
                name="billingCvv"
                required
                className="mt-1 w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-slate-100"
                placeholder="123"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Billing ZIP</span>
              <input
                id="billing-zip"
                name="billingZip"
                required
                className="mt-1 w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-slate-100"
                placeholder="90210"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Complete purchase
            </button>
            <button
              type="button"
              onClick={() => pushToast('Free trial started (demo)')}
              className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20"
            >
              Start free trial
            </button>
          </div>

          <TaxGuardInterceptor lockDurationHours={24} />
        </form>
      </section>
    </div>
  )
}
