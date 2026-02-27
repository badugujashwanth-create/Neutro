import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type RequesterRole = 'user' | 'hr' | 'admin' | 'superadmin'

interface AggregateRequest {
  dateFrom: string
  dateTo: string
  cohortFilters?: Record<string, string | string[]>
  metrics: string[]
  epsilonOverride?: number
  requesterRole?: string
}

interface DpConfigRow {
  metric: string
  epsilon: number
  min_cohort_k: number
  monthly_budget_cap: number
}

const DEFAULT_K = 30
const DEFAULT_BUDGET = 8
const DEFAULT_EPSILON = 0.7

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function laplaceNoise(scale: number): number {
  const u = Math.random() - 0.5
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
}

function toMonthDateKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function roleFromUser(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): RequesterRole {
  const appRole = typeof user?.app_metadata?.role === 'string' ? user.app_metadata.role : null
  const userRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null
  const candidate = (appRole ?? userRole ?? 'user').toLowerCase()
  if (candidate === 'hr') return 'hr'
  if (candidate === 'admin') return 'admin'
  if (candidate === 'superadmin') return 'superadmin'
  return 'user'
}

function normalizeRole(input: string | undefined): RequesterRole {
  const candidate = (input ?? 'user').toLowerCase()
  if (candidate === 'hr') return 'hr'
  if (candidate === 'admin') return 'admin'
  if (candidate === 'superadmin') return 'superadmin'
  return 'user'
}

function clampCount(value: number): number {
  return Math.max(0, Math.round(value))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const allowUnsignedDemo = Deno.env.get('ALLOW_UNSIGNED_DEMO') === 'true'
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Missing Supabase env configuration' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader && !allowUnsignedDemo) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  let payload: AggregateRequest
  try {
    payload = (await req.json()) as AggregateRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!payload.dateFrom || !payload.dateTo || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
    return json({ error: 'dateFrom, dateTo and metrics are required' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceKey)
  let requesterRole: RequesterRole = normalizeRole(payload.requesterRole)
  let requesterId: string | null = null

  if (authHeader) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (user) {
      requesterRole = roleFromUser(user)
      requesterId = user.id
    } else if (!allowUnsignedDemo) {
      return json({ error: 'Invalid auth token' }, 401)
    }
  } else if (allowUnsignedDemo) {
    requesterId = 'demo-local'
  }
  const cohortDefinition = payload.cohortFilters ?? {}
  const requestedAt = new Date().toISOString()

  const writeAudit = async (params: {
    allowed: boolean
    reason?: string
    epsilonUsed: number
    resultSize: number
  }) => {
    await adminClient.from('dp_audit_log').insert({
      requester_id: requesterId,
      requester_role: requesterRole,
      cohort_definition: cohortDefinition,
      metrics: payload.metrics,
      epsilon_used: params.epsilonUsed,
      result_size: params.resultSize,
      allowed: params.allowed,
      reason: params.reason ?? null,
      requested_at: requestedAt,
    })
  }

  if (!['hr', 'admin', 'superadmin'].includes(requesterRole)) {
    await writeAudit({
      allowed: false,
      reason: 'Requester role not allowed for aggregate endpoint',
      epsilonUsed: 0,
      resultSize: 0,
    })
    return json({ error: 'Requester role not allowed for aggregate endpoint' }, 403)
  }

  const { data: configRows, error: configError } = await adminClient
    .from('dp_config')
    .select('metric, epsilon, min_cohort_k, monthly_budget_cap')

  if (configError) {
    return json({ error: configError.message }, 500)
  }

  const configByMetric = new Map<string, DpConfigRow>()
  for (const row of (configRows ?? []) as DpConfigRow[]) {
    configByMetric.set(row.metric, row)
  }

  const kThreshold = (configRows?.[0]?.min_cohort_k as number | undefined) ?? DEFAULT_K
  const monthlyBudgetCap = (configRows?.[0]?.monthly_budget_cap as number | undefined) ?? DEFAULT_BUDGET

  let query = adminClient
    .from('user_metrics')
    .select('user_id, overload, attention, confusion, mode, org_id, role, recorded_at')
    .gte('recorded_at', payload.dateFrom)
    .lte('recorded_at', payload.dateTo)

  const filters = payload.cohortFilters ?? {}
  const applyFilter = (column: string, value: string | string[] | undefined) => {
    if (!value) return
    if (Array.isArray(value) && value.length > 0) {
      query = query.in(column, value)
      return
    }
    if (typeof value === 'string' && value.length > 0) {
      query = query.eq(column, value)
    }
  }

  applyFilter('role', filters.role)
  applyFilter('mode', filters.mode)
  applyFilter('org_id', filters.org)

  const { data: cohortRows, error: cohortError } = await query
  if (cohortError) {
    return json({ error: cohortError.message }, 500)
  }

  const rows = cohortRows ?? []
  const cohortSize = new Set(rows.map((row) => row.user_id as string)).size

  if (cohortSize < kThreshold) {
    await writeAudit({
      allowed: false,
      reason: `Cohort size ${cohortSize} is below k=${kThreshold}`,
      epsilonUsed: 0,
      resultSize: cohortSize,
    })
    return json({ error: `Cohort size ${cohortSize} is below k=${kThreshold}` }, 400)
  }

  const epsilonForMetric = (metric: string): number => {
    if (payload.epsilonOverride && payload.epsilonOverride > 0) return payload.epsilonOverride
    return configByMetric.get(metric)?.epsilon ?? DEFAULT_EPSILON
  }

  const epsilonUsed = payload.metrics.reduce((sum, metric) => sum + epsilonForMetric(metric), 0)
  const monthKey = toMonthDateKey(requestedAt)

  const { data: monthBudgetRows, error: monthBudgetError } = await adminClient
    .from('dp_budget_log')
    .select('epsilon_used')
    .eq('window_month', monthKey)

  if (monthBudgetError) {
    return json({ error: monthBudgetError.message }, 500)
  }

  const usedThisMonth = (monthBudgetRows ?? []).reduce((sum, row) => sum + Number(row.epsilon_used ?? 0), 0)
  if (usedThisMonth + epsilonUsed > monthlyBudgetCap) {
    await writeAudit({
      allowed: false,
      reason: 'Monthly privacy budget exceeded',
      epsilonUsed,
      resultSize: cohortSize,
    })
    return json({ error: 'Monthly privacy budget exceeded' }, 429)
  }

  const results: Record<string, number> = {}
  for (const metric of payload.metrics) {
    const epsilon = Math.max(epsilonForMetric(metric), 0.01)
    const scale = 1 / epsilon

    if (metric === 'avg_overload') {
      const mean = rows.reduce((sum, row) => sum + Number(row.overload ?? 0), 0) / rows.length
      results[metric] = Number((mean + laplaceNoise(scale)).toFixed(2))
      continue
    }

    if (metric === 'high_overload_count') {
      const count = rows.filter((row) => Number(row.overload ?? 0) >= 75).length
      results[metric] = clampCount(count + laplaceNoise(scale))
      continue
    }

    if (metric === 'avg_attention') {
      const mean = rows.reduce((sum, row) => sum + Number(row.attention ?? 0), 0) / rows.length
      results[metric] = Number((mean + laplaceNoise(scale)).toFixed(2))
      continue
    }

    if (metric === 'avg_confusion') {
      const mean = rows.reduce((sum, row) => sum + Number(row.confusion ?? 0), 0) / rows.length
      results[metric] = Number((mean + laplaceNoise(scale)).toFixed(2))
      continue
    }

    results[metric] = Number(laplaceNoise(scale).toFixed(2))
  }

  await adminClient.from('dp_budget_log').insert(
    payload.metrics.map((metric) => ({
      metric,
      cohort_definition: cohortDefinition,
      epsilon_used: epsilonForMetric(metric),
      requester_role: requesterRole,
      requester_id: requesterId,
      window_month: monthKey,
      created_at: requestedAt,
    })),
  )

  await writeAudit({
    allowed: true,
    epsilonUsed,
    resultSize: cohortSize,
  })

  return json({
    cohortSize,
    kThreshold,
    results,
    epsilonUsed,
    remainingMonthlyBudget: Math.max(0, monthlyBudgetCap - (usedThisMonth + epsilonUsed)),
    dpProtected: true,
  })
})
