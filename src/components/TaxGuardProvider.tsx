import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { readTaxGuardHistory, syncIntentToSupabase, writeTaxGuardHistory } from '../lib/taxGuard/storage.ts'
import type { CognitiveSnapshot, TaxGuardEntry, TaxGuardOutcome, TaxGuardStatus } from '../types/taxGuard.ts'

const MEMORY_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'want',
  'need',
  'will',
  'have',
  'about',
  'just',
  'now',
])

interface CreateLockInput {
  url: string
  reason: string
  context: CognitiveSnapshot
  durationHours: number
  status?: TaxGuardStatus
}

interface TaxGuardContextValue {
  entries: TaxGuardEntry[]
  memoryList: TaxGuardEntry[]
  createLock: (input: CreateLockInput) => TaxGuardEntry
  updateEntry: (id: string, patch: Partial<TaxGuardEntry>) => TaxGuardEntry | null
  recordOutcome: (id: string, outcome: TaxGuardOutcome) => TaxGuardEntry | null
  fastForwardLock: (id: string) => TaxGuardEntry | null
  clearHistory: () => void
  getLatestForUrl: (url: string) => TaxGuardEntry | null
  searchSimilar: (query: string, currentUrl: string, limit?: number) => TaxGuardEntry[]
}

const TaxGuardContext = createContext<TaxGuardContextValue | null>(null)

function sortByNewest(entries: TaxGuardEntry[]): TaxGuardEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((part) => part.length >= 3 && !MEMORY_STOP_WORDS.has(part))
}

function getEntryStatusFromOutcome(outcome: TaxGuardOutcome): TaxGuardStatus {
  return outcome === 'yes' ? 'approved' : 'cancelled'
}

export function TaxGuardProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TaxGuardEntry[]>(() => readTaxGuardHistory())
  const entriesRef = useRef<TaxGuardEntry[]>(entries)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  const persist = useCallback((next: TaxGuardEntry[]) => {
    const sorted = sortByNewest(next)
    writeTaxGuardHistory(sorted)
    setEntries(sorted)
  }, [])

  const createLock = useCallback(
    (input: CreateLockInput): TaxGuardEntry => {
      const createdAt = new Date().toISOString()
      const unlockAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString()

      const entry: TaxGuardEntry = {
        id: crypto.randomUUID(),
        url: input.url,
        reason: input.reason,
        createdAt,
        unlockAt,
        status: input.status ?? 'locked',
        context: input.context,
      }

      persist([entry, ...entriesRef.current.filter((existing) => existing.id !== entry.id)])
      void syncIntentToSupabase(entry)
      return entry
    },
    [persist],
  )

  const updateEntry = useCallback(
    (id: string, patch: Partial<TaxGuardEntry>): TaxGuardEntry | null => {
      const target = entriesRef.current.find((entry) => entry.id === id)
      if (!target) return null

      const updated: TaxGuardEntry = { ...target, ...patch }
      persist(entriesRef.current.map((entry) => (entry.id === id ? updated : entry)))
      return updated
    },
    [persist],
  )

  const recordOutcome = useCallback(
    (id: string, outcome: TaxGuardOutcome): TaxGuardEntry | null =>
      updateEntry(id, {
        status: getEntryStatusFromOutcome(outcome),
        outcome,
        outcomeAt: new Date().toISOString(),
      }),
    [updateEntry],
  )

  const fastForwardLock = useCallback(
    (id: string): TaxGuardEntry | null =>
      updateEntry(id, {
        unlockAt: new Date(Date.now() - 1000).toISOString(),
        status: 'unlocked_pending_decision',
      }),
    [updateEntry],
  )

  const clearHistory = useCallback(() => {
    persist([])
  }, [persist])

  const getLatestForUrl = useCallback(
    (url: string): TaxGuardEntry | null => sortByNewest(entries.filter((entry) => entry.url === url))[0] ?? null,
    [entries],
  )

  const memoryList = useMemo(() => entries.slice(0, 10), [entries])

  const searchSimilar = useCallback(
    (query: string, currentUrl: string, limit: number = 5): TaxGuardEntry[] => {
      const queryTokens = tokenize(query)
      if (queryTokens.length === 0) return []

      return entries
        .filter((entry) => entry.reason.trim().length > 0 && entry.url !== currentUrl)
        .map((entry) => {
          const entryTokens = new Set(tokenize(entry.reason))
          const overlap = queryTokens.filter((token) => entryTokens.has(token)).length
          return { entry, overlap }
        })
        .filter((result) => result.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || Date.parse(b.entry.createdAt) - Date.parse(a.entry.createdAt))
        .slice(0, limit)
        .map((result) => result.entry)
    },
    [entries],
  )

  const value = useMemo<TaxGuardContextValue>(
    () => ({
      entries,
      memoryList,
      createLock,
      updateEntry,
      recordOutcome,
      fastForwardLock,
      clearHistory,
      getLatestForUrl,
      searchSimilar,
    }),
    [clearHistory, createLock, entries, fastForwardLock, getLatestForUrl, memoryList, recordOutcome, searchSimilar, updateEntry],
  )

  return <TaxGuardContext.Provider value={value}>{children}</TaxGuardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTaxGuard() {
  const context = useContext(TaxGuardContext)
  if (!context) {
    throw new Error('useTaxGuard must be used within TaxGuardProvider')
  }
  return context
}
