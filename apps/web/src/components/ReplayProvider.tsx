import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { addReplayMarker, isReplayRecording, startReplayRecording, stopReplayRecording } from '../lib/replay/recorder.ts'
import { listReplayBundles, saveReplayBundle } from '../lib/replay/storage.ts'
import type { ReplayBundle, ReplayMarker } from '../types/replay.ts'

interface ReplayContextValue {
  isRecording: boolean
  sessions: ReplayBundle[]
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  refreshSessions: () => Promise<void>
  addMarker: (label: string, kind?: ReplayMarker['kind']) => void
}

const ReplayContext = createContext<ReplayContextValue | null>(null)

export function ReplayProvider({ children }: { children: ReactNode }) {
  const [recording, setRecording] = useState(() => isReplayRecording())
  const [sessions, setSessions] = useState<ReplayBundle[]>([])

  const refreshSessions = useCallback(async () => {
    const bundles = await listReplayBundles()
    setSessions(bundles)
  }, [])

  useEffect(() => {
    let active = true
    void listReplayBundles().then((bundles) => {
      if (active) setSessions(bundles)
    })
    return () => {
      active = false
    }
  }, [])

  const startRecording = useCallback(async () => {
    const started = startReplayRecording()
    if (started) {
      setRecording(true)
      addReplayMarker('Replay Started', 'system')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const bundle = stopReplayRecording()
    setRecording(false)
    if (!bundle) return
    await saveReplayBundle(bundle)
    await refreshSessions()
  }, [refreshSessions])

  const addMarkerStable = useCallback((label: string, kind: ReplayMarker['kind'] = 'system') => {
    addReplayMarker(label, kind)
  }, [])

  const value = useMemo<ReplayContextValue>(
    () => ({
      isRecording: recording,
      sessions,
      startRecording,
      stopRecording,
      refreshSessions,
      addMarker: addMarkerStable,
    }),
    [addMarkerStable, recording, refreshSessions, sessions, startRecording, stopRecording],
  )

  return <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReplay() {
  const context = useContext(ReplayContext)
  if (!context) {
    throw new Error('useReplay must be used within ReplayProvider')
  }
  return context
}
