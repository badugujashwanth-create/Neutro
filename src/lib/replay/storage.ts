import type { ReplayBundle } from '../../types/replay'

const DB_NAME = 'nexus-neuroos-replay'
const DB_VERSION = 1
const STORE = 'replays'
const FALLBACK_KEY = 'nexus-neuroos-replay-fallback'

const hasIndexedDb = typeof window !== 'undefined' && 'indexedDB' in window

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb()
  try {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    return await run(store)
  } finally {
    db.close()
  }
}

function readFallback(): ReplayBundle[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ReplayBundle[]
  } catch {
    return []
  }
}

function writeFallback(bundles: ReplayBundle[]) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(bundles))
}

function sortByNewest(bundles: ReplayBundle[]): ReplayBundle[] {
  return [...bundles].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function listReplayBundles(): Promise<ReplayBundle[]> {
  if (!hasIndexedDb) return sortByNewest(readFallback())

  try {
    return await withStore('readonly', async (store) => {
      const bundles = await requestToPromise<ReplayBundle[]>(store.getAll())
      return sortByNewest(bundles)
    })
  } catch {
    return sortByNewest(readFallback())
  }
}

export async function getReplayBundle(id: string): Promise<ReplayBundle | null> {
  if (!hasIndexedDb) {
    return readFallback().find((bundle) => bundle.id === id) ?? null
  }

  try {
    return await withStore('readonly', async (store) => {
      const bundle = await requestToPromise<ReplayBundle | undefined>(store.get(id))
      return bundle ?? null
    })
  } catch {
    return readFallback().find((bundle) => bundle.id === id) ?? null
  }
}

export async function saveReplayBundle(bundle: ReplayBundle): Promise<void> {
  if (!hasIndexedDb) {
    const existing = readFallback().filter((item) => item.id !== bundle.id)
    writeFallback(sortByNewest([bundle, ...existing]))
    return
  }

  try {
    await withStore('readwrite', async (store) => {
      await requestToPromise(store.put(bundle))
    })
  } catch {
    const existing = readFallback().filter((item) => item.id !== bundle.id)
    writeFallback(sortByNewest([bundle, ...existing]))
  }
}

export async function deleteReplayBundle(id: string): Promise<void> {
  if (!hasIndexedDb) {
    writeFallback(readFallback().filter((bundle) => bundle.id !== id))
    return
  }

  try {
    await withStore('readwrite', async (store) => {
      await requestToPromise(store.delete(id))
    })
  } catch {
    writeFallback(readFallback().filter((bundle) => bundle.id !== id))
  }
}

export async function clearReplayBundles(): Promise<void> {
  if (!hasIndexedDb) {
    writeFallback([])
    return
  }

  try {
    await withStore('readwrite', async (store) => {
      await requestToPromise(store.clear())
    })
  } catch {
    writeFallback([])
  }
}
