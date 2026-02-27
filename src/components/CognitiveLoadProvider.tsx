import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_COGNITIVE_STATE, SIMULATED_OVERLOAD_STATE, evaluateCognitiveLoad } from '../lib/taxGuard/evaluator.ts'
import type { CognitiveAssessment, CognitiveLoadState } from '../types/taxGuard.ts'

interface CognitiveLoadContextValue {
  state: CognitiveLoadState
  assessment: CognitiveAssessment
  simulateOverload: boolean
  setSimulateOverload: (next: boolean) => void
  updateState: (patch: Partial<CognitiveLoadState>) => void
  resetBreakTimer: () => void
}

const CognitiveLoadContext = createContext<CognitiveLoadContextValue | null>(null)

export function CognitiveLoadProvider({ children }: { children: ReactNode }) {
  const [manualState, setManualState] = useState<CognitiveLoadState>(DEFAULT_COGNITIVE_STATE)
  const [simulateOverload, setSimulateOverload] = useState(false)

  const state = simulateOverload ? SIMULATED_OVERLOAD_STATE : manualState

  const assessment = useMemo(() => evaluateCognitiveLoad(state), [state])

  const value = useMemo<CognitiveLoadContextValue>(
    () => ({
      state,
      assessment,
      simulateOverload,
      setSimulateOverload,
      updateState: (patch) => setManualState((previous) => ({ ...previous, ...patch })),
      resetBreakTimer: () => setManualState((previous) => ({ ...previous, minutesSinceLastBreak: 0 })),
    }),
    [assessment, simulateOverload, state],
  )

  return <CognitiveLoadContext.Provider value={value}>{children}</CognitiveLoadContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCognitiveLoad() {
  const context = useContext(CognitiveLoadContext)
  if (!context) {
    throw new Error('useCognitiveLoad must be used within CognitiveLoadProvider')
  }
  return context
}
