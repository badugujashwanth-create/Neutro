import type { TaxGuardEntry } from '../../types/taxGuard.ts'

const STORAGE_KEY = 'nexus-tax-guard-history-v1'

function sortByNewest(entries: TaxGuardEntry[]): TaxGuardEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function readTaxGuardHistory(): TaxGuardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TaxGuardEntry[]
    return sortByNewest(parsed)
  } catch {
    return []
  }
}

export function writeTaxGuardHistory(entries: TaxGuardEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByNewest(entries)))
}

export async function syncIntentToSupabase(entry: TaxGuardEntry): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) return

  try {
    await fetch(`${supabaseUrl}/rest/v1/tax_guard_intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: entry.id,
        url: entry.url,
        reason: entry.reason,
        created_at: entry.createdAt,
        unlock_at: entry.unlockAt,
      }),
    })
  } catch {
    // Optional sync, local storage remains source of truth.
  }
}
