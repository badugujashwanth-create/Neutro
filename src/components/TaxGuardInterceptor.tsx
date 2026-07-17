import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { scanTransactionalContext } from '../lib/taxGuard/detection.ts'
import { useCognitiveLoad } from './CognitiveLoadProvider.tsx'
import { useTaxGuard } from './TaxGuardProvider.tsx'
import { useToast } from './useToast.ts'

interface TaxGuardInterceptorProps {
  lockDurationHours?: number
}

interface OriginalButtonState {
  disabled: boolean | null
  ariaDisabled: string | null
  display: string
  pointerEvents: string
  opacity: string
}

function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms)
  const hours = Math.floor(safe / (1000 * 60 * 60))
  const minutes = Math.floor((safe % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

export function TaxGuardInterceptor({ lockDurationHours = 24 }: TaxGuardInterceptorProps) {
  const location = useLocation()
  const { pushToast } = useToast()
  const { state, assessment } = useCognitiveLoad()
  const { entries, createLock, updateEntry, recordOutcome, memoryList, searchSimilar } = useTaxGuard()

  const [reason, setReason] = useState('')
  const [overridePhrase, setOverridePhrase] = useState('')
  const [detection, setDetection] = useState(() => scanTransactionalContext())
  const [nowMs, setNowMs] = useState(() => Date.now())
  const lockedButtonsRef = useRef<Map<HTMLElement, OriginalButtonState>>(new Map())

  const currentUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`
  const currentEntry = useMemo(() => entries.find((entry) => entry.url === currentUrl) ?? null, [currentUrl, entries])

  const lockStillActive = useMemo(() => {
    if (!currentEntry) return false
    if (currentEntry.status === 'approved' || currentEntry.status === 'cancelled' || currentEntry.status === 'overridden') {
      return false
    }
    return Date.parse(currentEntry.unlockAt) > nowMs
  }, [currentEntry, nowMs])

  const requiresDecision = useMemo(() => {
    if (!currentEntry) return false
    if (currentEntry.status === 'approved' || currentEntry.status === 'cancelled' || currentEntry.status === 'overridden') {
      return false
    }
    return Date.parse(currentEntry.unlockAt) <= nowMs
  }, [currentEntry, nowMs])

  const stateTriggeredGate = detection.isTransactional && assessment.shouldGate && currentEntry?.status !== 'overridden'
  const shouldBlockButtons = detection.isTransactional && (lockStillActive || stateTriggeredGate) && !requiresDecision
  const similarPurchases = useMemo(() => searchSimilar(reason, currentUrl, 4), [currentUrl, reason, searchSimilar])

  const restoreButtons = useCallback(() => {
    for (const [button, original] of lockedButtonsRef.current.entries()) {
      if ('disabled' in button && original.disabled !== null) {
        ;(button as HTMLButtonElement | HTMLInputElement).disabled = original.disabled
      }
      if (original.ariaDisabled === null) {
        button.removeAttribute('aria-disabled')
      } else {
        button.setAttribute('aria-disabled', original.ariaDisabled)
      }
      button.style.display = original.display
      button.style.pointerEvents = original.pointerEvents
      button.style.opacity = original.opacity
      button.removeAttribute('data-tax-guard-locked')
    }
    lockedButtonsRef.current.clear()
  }, [])

  const scanNow = useCallback(() => {
    setDetection(scanTransactionalContext(currentUrl))
  }, [currentUrl])

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => scanNow(), 0)

    const observer = new MutationObserver(() => scanNow())
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })

    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [scanNow])

  useEffect(() => {
    if (!shouldBlockButtons) {
      restoreButtons()
      return
    }

    detection.matchedButtons.forEach((button) => {
      if (!lockedButtonsRef.current.has(button)) {
        lockedButtonsRef.current.set(button, {
          disabled:
            button instanceof HTMLButtonElement || button instanceof HTMLInputElement ? Boolean(button.disabled) : null,
          ariaDisabled: button.getAttribute('aria-disabled'),
          display: button.style.display,
          pointerEvents: button.style.pointerEvents,
          opacity: button.style.opacity,
        })
      }

      if (button instanceof HTMLButtonElement || button instanceof HTMLInputElement) {
        button.disabled = true
      }

      button.setAttribute('aria-disabled', 'true')
      button.setAttribute('data-tax-guard-locked', 'true')
      button.style.display = 'none'
      button.style.pointerEvents = 'none'
      button.style.opacity = '0.35'
    })
  }, [detection.matchedButtons, restoreButtons, shouldBlockButtons])

  useEffect(() => () => restoreButtons(), [restoreButtons])

  const onSaveReason = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      pushToast('Reason is required before enabling the 24h lock')
      return
    }

    const snapshot = {
      overloadScore: state.overloadScore,
      attentionStability: state.attentionStability,
      minutesSinceLastBreak: state.minutesSinceLastBreak,
      band: assessment.band,
      crashRisk: assessment.crashRisk,
      shouldGate: assessment.shouldGate,
    }

    createLock({
      url: currentUrl,
      reason: trimmed,
      context: snapshot,
      durationHours: lockDurationHours,
      status: 'locked',
    })
    setReason('')
    pushToast(`Cooling-Off Lock started for ${lockDurationHours}h`)
  }

  const onRemindLater = () => {
    if (!currentEntry) {
      const fallbackReason = reason.trim() || 'Reminder requested'
      const snapshot = {
        overloadScore: state.overloadScore,
        attentionStability: state.attentionStability,
        minutesSinceLastBreak: state.minutesSinceLastBreak,
        band: assessment.band,
        crashRisk: assessment.crashRisk,
        shouldGate: assessment.shouldGate,
      }

      createLock({
        url: currentUrl,
        reason: fallbackReason,
        context: snapshot,
        durationHours: lockDurationHours,
        status: 'remind_later',
      })
    } else {
      updateEntry(currentEntry.id, { status: 'remind_later' })
    }

    pushToast('Reminder saved. Check back after cooldown.')
  }

  const onEmergencyOverride = () => {
    if (overridePhrase.trim().toLowerCase() !== 'i understand') {
      pushToast('Type "I understand" to use emergency override')
      return
    }

    if (currentEntry) {
      updateEntry(currentEntry.id, {
        status: 'overridden',
        overridePhraseConfirmed: true,
        unlockAt: new Date().toISOString(),
      })
    } else {
      const snapshot = {
        overloadScore: state.overloadScore,
        attentionStability: state.attentionStability,
        minutesSinceLastBreak: state.minutesSinceLastBreak,
        band: assessment.band,
        crashRisk: assessment.crashRisk,
        shouldGate: assessment.shouldGate,
      }

      createLock({
        url: currentUrl,
        reason: reason.trim() || 'Emergency override without saved reason',
        context: snapshot,
        durationHours: 0,
        status: 'overridden',
      })
    }

    setOverridePhrase('')
    pushToast('Emergency override enabled')
  }

  if (!detection.isTransactional) return null

  if (requiresDecision && currentEntry) {
    return (
      <section className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4">
        <h3 className="text-base font-semibold text-emerald-200">Cooling-Off Complete</h3>
        <p className="mt-1 text-sm text-slate-200">Saved reason: "{currentEntry.reason}"</p>
        <p className="mt-2 text-sm text-slate-300">Still want it?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              recordOutcome(currentEntry.id, 'yes')
              pushToast('Outcome recorded: still wants it')
            }}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-400"
          >
            Yes
          </button>
          <button
            onClick={() => {
              recordOutcome(currentEntry.id, 'no')
              pushToast('Outcome recorded: decided not to buy')
            }}
            className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700/60"
          >
            No
          </button>
        </div>
      </section>
    )
  }

  if (!shouldBlockButtons) return null

  return (
    <section className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
      <h3 className="text-base font-semibold text-amber-200">Cooling-Off Lock: {lockDurationHours} hours</h3>
      <p className="mt-1 text-sm text-slate-200">
        Transactional context detected. Purchase and trial actions are blocked while overload risk is high.
      </p>
      <p className="mt-2 text-xs text-slate-300">
        State: {assessment.band.toUpperCase()} | Overload {state.overloadScore} | Attention {state.attentionStability} |
        Break {state.minutesSinceLastBreak}m
      </p>
      {currentEntry && lockStillActive && (
        <p className="mt-1 text-xs text-amber-100">Time remaining: {formatRemaining(Date.parse(currentEntry.unlockAt) - nowMs)}</p>
      )}

      <label className="mt-3 block text-sm text-slate-100">
        Why do you want this?
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="One short sentence"
          className="mt-1 w-full rounded-md border border-amber-300/40 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none ring-amber-300/50 focus:ring-2"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={onSaveReason}
          className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-300"
        >
          Save reason
        </button>
        <button
          onClick={onRemindLater}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700/60"
        >
          Remind me later
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-slate-950/50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Emergency override</p>
        <p className="mt-1 text-xs text-slate-300">Type "I understand" to temporarily bypass this lock.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={overridePhrase}
            onChange={(event) => setOverridePhrase(event.target.value)}
            placeholder="I understand"
            className="min-w-52 flex-1 rounded-md border border-border bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-300 transition focus:ring-2"
          />
          <button
            onClick={onEmergencyOverride}
            className="rounded-md border border-rose-300/60 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
          >
            Emergency override
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Memory (Last 10)</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {memoryList.length === 0 && <li>No prior locked actions.</li>}
            {memoryList.slice(0, 10).map((entry) => (
              <li key={entry.id}>
                {new Date(entry.createdAt).toLocaleDateString()} - {entry.reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Past Similar Purchases</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {similarPurchases.length === 0 && <li>Add a reason to search similar notes.</li>}
            {similarPurchases.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.createdAt).toLocaleDateString()} - {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
