-- Unified MVP schema for Features #1, #6, #7, #10
-- Tables are local/cloud compatible and enforce least-privilege via RLS.

create extension if not exists pgcrypto;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'child'
  );
$$;

create or replace function public.current_user_id()
returns text
language sql
stable
as $$
  select coalesce(auth.uid()::text, auth.jwt() ->> 'sub', 'anonymous');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'superadmin';
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recorded_at timestamptz not null default now(),
  overload double precision not null check (overload >= 0 and overload <= 100),
  attention double precision not null check (attention >= 0 and attention <= 100),
  confusion double precision not null check (confusion >= 0 and confusion <= 100),
  mode text not null default 'normal',
  org_id text not null default 'org-1',
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists user_metrics_recorded_at_idx on public.user_metrics (recorded_at);
create index if not exists user_metrics_org_mode_idx on public.user_metrics (org_id, mode);
create index if not exists user_metrics_user_idx on public.user_metrics (user_id);

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default public.current_user_id(),
  app_name text not null,
  started_at timestamptz not null,
  duration_sec integer not null check (duration_sec >= 0),
  switch_count integer not null default 0 check (switch_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists telemetry_events_started_at_idx on public.telemetry_events (started_at desc);
create index if not exists telemetry_events_user_idx on public.telemetry_events (user_id);

create table if not exists public.reading_profiles (
  id text primary key,
  profile_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.edu_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  parent_id text not null,
  child_id text not null unique,
  org_id text not null default 'org-1',
  created_at timestamptz not null default now()
);

create table if not exists public.parent_controls (
  id uuid primary key default gen_random_uuid(),
  child_id text not null unique,
  parent_id text not null,
  allowed_start time not null default time '08:00',
  allowed_end time not null default time '20:00',
  max_daily_usage_minutes integer not null default 90 check (max_daily_usage_minutes >= 0),
  break_reminder_interval_minutes integer not null default 20 check (break_reminder_interval_minutes >= 5),
  disabled_modules text[] not null default '{}',
  pause_access_now boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.edu_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  age_group text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  sensitive_topics boolean not null default false,
  status text not null check (status in ('draft', 'pending_review', 'approved', 'rejected')) default 'draft',
  created_by text not null,
  reviewed_by text,
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists edu_content_status_idx on public.edu_content (status);

create table if not exists public.edu_alerts (
  id uuid primary key default gen_random_uuid(),
  child_id text not null,
  source text not null check (source in ('system', 'child', 'teacher', 'parent')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  message text not null,
  status text not null check (status in ('open', 'resolved')) default 'open',
  created_by text,
  resolved_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists edu_alerts_child_status_idx on public.edu_alerts (child_id, status, created_at desc);

create table if not exists public.edu_safety_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'restricted_page_attempt',
      'content_rejected',
      'parent_pause_toggled',
      'help_requested',
      'overload_alert_triggered'
    )
  ),
  actor_user_id text not null,
  child_id text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists edu_safety_logs_child_idx on public.edu_safety_logs (child_id, created_at desc);

create table if not exists public.dp_config (
  id uuid primary key default gen_random_uuid(),
  metric text not null unique,
  epsilon double precision not null check (epsilon > 0),
  delta double precision,
  min_cohort_k integer not null default 30 check (min_cohort_k >= 2),
  monthly_budget_cap double precision not null default 8 check (monthly_budget_cap > 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dp_budget_log (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  cohort_definition jsonb not null default '{}'::jsonb,
  epsilon_used double precision not null check (epsilon_used > 0),
  requester_role text not null,
  requester_id text,
  window_month date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now()
);

create index if not exists dp_budget_log_window_idx on public.dp_budget_log (window_month, created_at desc);

create table if not exists public.dp_audit_log (
  id uuid primary key default gen_random_uuid(),
  requester_id text,
  requester_role text not null,
  cohort_definition jsonb not null default '{}'::jsonb,
  metrics text[] not null,
  epsilon_used double precision not null default 0,
  result_size integer not null default 0,
  allowed boolean not null,
  reason text,
  requested_at timestamptz not null default now()
);

create index if not exists dp_audit_log_requested_idx on public.dp_audit_log (requested_at desc);

drop trigger if exists parent_controls_set_updated_at on public.parent_controls;
create trigger parent_controls_set_updated_at
before update on public.parent_controls
for each row execute function public.set_updated_at();

drop trigger if exists edu_content_set_updated_at on public.edu_content;
create trigger edu_content_set_updated_at
before update on public.edu_content
for each row execute function public.set_updated_at();

drop trigger if exists reading_profiles_set_updated_at on public.reading_profiles;
create trigger reading_profiles_set_updated_at
before update on public.reading_profiles
for each row execute function public.set_updated_at();

drop trigger if exists dp_config_set_updated_at on public.dp_config;
create trigger dp_config_set_updated_at
before update on public.dp_config
for each row execute function public.set_updated_at();

insert into public.dp_config (metric, epsilon, min_cohort_k, monthly_budget_cap)
values
  ('avg_overload', 0.8, 30, 8),
  ('high_overload_count', 0.7, 30, 8),
  ('avg_attention', 0.8, 30, 8),
  ('avg_confusion', 0.8, 30, 8)
on conflict (metric) do nothing;

insert into public.edu_assignments (teacher_id, parent_id, child_id, org_id)
values ('teacher-1', 'parent-1', 'child-1', 'org-1')
on conflict (child_id) do nothing;

insert into public.parent_controls (
  child_id,
  parent_id,
  allowed_start,
  allowed_end,
  max_daily_usage_minutes,
  break_reminder_interval_minutes,
  disabled_modules,
  pause_access_now
)
values ('child-1', 'parent-1', time '08:00', time '20:00', 90, 20, '{}', false)
on conflict (child_id) do nothing;

create or replace function public.is_teacher_for_child(target_child_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.edu_assignments ea
    where ea.child_id = target_child_id
      and ea.teacher_id = public.current_user_id()
  );
$$;

create or replace function public.is_parent_for_child(target_child_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.edu_assignments ea
    where ea.child_id = target_child_id
      and ea.parent_id = public.current_user_id()
  );
$$;

alter table public.user_metrics enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.reading_profiles enable row level security;
alter table public.edu_assignments enable row level security;
alter table public.parent_controls enable row level security;
alter table public.edu_content enable row level security;
alter table public.edu_alerts enable row level security;
alter table public.edu_safety_logs enable row level security;
alter table public.dp_config enable row level security;
alter table public.dp_budget_log enable row level security;
alter table public.dp_audit_log enable row level security;

drop policy if exists user_metrics_select_policy on public.user_metrics;
create policy user_metrics_select_policy
on public.user_metrics for select
using (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists user_metrics_write_policy on public.user_metrics;
create policy user_metrics_write_policy
on public.user_metrics for insert
with check (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists user_metrics_update_policy on public.user_metrics;
create policy user_metrics_update_policy
on public.user_metrics for update
using (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
)
with check (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists telemetry_events_select_policy on public.telemetry_events;
create policy telemetry_events_select_policy
on public.telemetry_events for select
using (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists telemetry_events_write_policy on public.telemetry_events;
create policy telemetry_events_write_policy
on public.telemetry_events for insert
with check (
  user_id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists reading_profiles_select_policy on public.reading_profiles;
create policy reading_profiles_select_policy
on public.reading_profiles for select
using (
  id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists reading_profiles_write_policy on public.reading_profiles;
create policy reading_profiles_write_policy
on public.reading_profiles for insert
with check (
  id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists reading_profiles_update_policy on public.reading_profiles;
create policy reading_profiles_update_policy
on public.reading_profiles for update
using (
  id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
)
with check (
  id = public.current_user_id()
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists edu_assignments_superadmin_policy on public.edu_assignments;
create policy edu_assignments_superadmin_policy
on public.edu_assignments for all
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists edu_assignments_teacher_select_policy on public.edu_assignments;
create policy edu_assignments_teacher_select_policy
on public.edu_assignments for select
using (teacher_id = public.current_user_id());

drop policy if exists edu_assignments_parent_select_policy on public.edu_assignments;
create policy edu_assignments_parent_select_policy
on public.edu_assignments for select
using (parent_id = public.current_user_id());

drop policy if exists edu_assignments_child_select_policy on public.edu_assignments;
create policy edu_assignments_child_select_policy
on public.edu_assignments for select
using (child_id = public.current_user_id());

drop policy if exists parent_controls_superadmin_policy on public.parent_controls;
create policy parent_controls_superadmin_policy
on public.parent_controls for all
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists parent_controls_parent_select_policy on public.parent_controls;
create policy parent_controls_parent_select_policy
on public.parent_controls for select
using (parent_id = public.current_user_id());

drop policy if exists parent_controls_parent_write_policy on public.parent_controls;
create policy parent_controls_parent_write_policy
on public.parent_controls for update
using (parent_id = public.current_user_id())
with check (parent_id = public.current_user_id());

drop policy if exists parent_controls_parent_insert_policy on public.parent_controls;
create policy parent_controls_parent_insert_policy
on public.parent_controls for insert
with check (parent_id = public.current_user_id());

drop policy if exists parent_controls_teacher_select_policy on public.parent_controls;
create policy parent_controls_teacher_select_policy
on public.parent_controls for select
using (public.is_teacher_for_child(child_id));

drop policy if exists parent_controls_child_select_policy on public.parent_controls;
create policy parent_controls_child_select_policy
on public.parent_controls for select
using (child_id = public.current_user_id());

drop policy if exists edu_content_superadmin_policy on public.edu_content;
create policy edu_content_superadmin_policy
on public.edu_content for all
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists edu_content_teacher_select_policy on public.edu_content;
create policy edu_content_teacher_select_policy
on public.edu_content for select
using (public.current_app_role() = 'teacher');

drop policy if exists edu_content_teacher_insert_policy on public.edu_content;
create policy edu_content_teacher_insert_policy
on public.edu_content for insert
with check (
  public.current_app_role() = 'teacher'
  and created_by = public.current_user_id()
);

drop policy if exists edu_content_teacher_update_policy on public.edu_content;
create policy edu_content_teacher_update_policy
on public.edu_content for update
using (public.current_app_role() = 'teacher')
with check (public.current_app_role() = 'teacher');

drop policy if exists edu_content_parent_select_policy on public.edu_content;
create policy edu_content_parent_select_policy
on public.edu_content for select
using (
  public.current_app_role() = 'parent'
  and status = 'approved'
);

drop policy if exists edu_content_child_select_policy on public.edu_content;
create policy edu_content_child_select_policy
on public.edu_content for select
using (
  public.current_app_role() = 'child'
  and status = 'approved'
);

drop policy if exists edu_alerts_superadmin_policy on public.edu_alerts;
create policy edu_alerts_superadmin_policy
on public.edu_alerts for all
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists edu_alerts_teacher_select_policy on public.edu_alerts;
create policy edu_alerts_teacher_select_policy
on public.edu_alerts for select
using (public.is_teacher_for_child(child_id));

drop policy if exists edu_alerts_teacher_update_policy on public.edu_alerts;
create policy edu_alerts_teacher_update_policy
on public.edu_alerts for update
using (public.is_teacher_for_child(child_id))
with check (public.is_teacher_for_child(child_id));

drop policy if exists edu_alerts_parent_select_policy on public.edu_alerts;
create policy edu_alerts_parent_select_policy
on public.edu_alerts for select
using (public.is_parent_for_child(child_id));

drop policy if exists edu_alerts_parent_update_policy on public.edu_alerts;
create policy edu_alerts_parent_update_policy
on public.edu_alerts for update
using (public.is_parent_for_child(child_id))
with check (public.is_parent_for_child(child_id));

drop policy if exists edu_alerts_child_select_policy on public.edu_alerts;
create policy edu_alerts_child_select_policy
on public.edu_alerts for select
using (child_id = public.current_user_id());

drop policy if exists edu_alerts_child_insert_policy on public.edu_alerts;
create policy edu_alerts_child_insert_policy
on public.edu_alerts for insert
with check (
  public.current_app_role() = 'child'
  and child_id = public.current_user_id()
  and source = 'child'
);

drop policy if exists edu_alerts_parent_insert_policy on public.edu_alerts;
create policy edu_alerts_parent_insert_policy
on public.edu_alerts for insert
with check (
  public.current_app_role() = 'parent'
  and public.is_parent_for_child(child_id)
);

drop policy if exists edu_alerts_teacher_insert_policy on public.edu_alerts;
create policy edu_alerts_teacher_insert_policy
on public.edu_alerts for insert
with check (
  public.current_app_role() = 'teacher'
  and public.is_teacher_for_child(child_id)
);

drop policy if exists edu_safety_logs_superadmin_policy on public.edu_safety_logs;
create policy edu_safety_logs_superadmin_policy
on public.edu_safety_logs for all
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists edu_safety_logs_teacher_select_policy on public.edu_safety_logs;
create policy edu_safety_logs_teacher_select_policy
on public.edu_safety_logs for select
using (child_id is not null and public.is_teacher_for_child(child_id));

drop policy if exists edu_safety_logs_parent_select_policy on public.edu_safety_logs;
create policy edu_safety_logs_parent_select_policy
on public.edu_safety_logs for select
using (child_id is not null and public.is_parent_for_child(child_id));

drop policy if exists edu_safety_logs_child_select_policy on public.edu_safety_logs;
create policy edu_safety_logs_child_select_policy
on public.edu_safety_logs for select
using (child_id = public.current_user_id());

drop policy if exists edu_safety_logs_child_insert_policy on public.edu_safety_logs;
create policy edu_safety_logs_child_insert_policy
on public.edu_safety_logs for insert
with check (
  public.current_app_role() = 'child'
  and actor_user_id = public.current_user_id()
  and child_id = public.current_user_id()
);

drop policy if exists edu_safety_logs_parent_insert_policy on public.edu_safety_logs;
create policy edu_safety_logs_parent_insert_policy
on public.edu_safety_logs for insert
with check (
  public.current_app_role() = 'parent'
  and actor_user_id = public.current_user_id()
  and child_id is not null
  and public.is_parent_for_child(child_id)
);

drop policy if exists edu_safety_logs_teacher_insert_policy on public.edu_safety_logs;
create policy edu_safety_logs_teacher_insert_policy
on public.edu_safety_logs for insert
with check (
  public.current_app_role() = 'teacher'
  and actor_user_id = public.current_user_id()
  and child_id is not null
  and public.is_teacher_for_child(child_id)
);

drop policy if exists dp_config_read_policy on public.dp_config;
create policy dp_config_read_policy
on public.dp_config for select
using (public.current_app_role() in ('hr', 'admin', 'superadmin'));

drop policy if exists dp_config_admin_write_policy on public.dp_config;
create policy dp_config_admin_write_policy
on public.dp_config for all
using (public.current_app_role() in ('admin', 'superadmin'))
with check (public.current_app_role() in ('admin', 'superadmin'));

drop policy if exists dp_budget_log_read_policy on public.dp_budget_log;
create policy dp_budget_log_read_policy
on public.dp_budget_log for select
using (public.current_app_role() in ('hr', 'admin', 'superadmin'));

drop policy if exists dp_budget_log_write_policy on public.dp_budget_log;
create policy dp_budget_log_write_policy
on public.dp_budget_log for insert
with check (
  auth.role() = 'service_role'
  or public.current_app_role() in ('admin', 'superadmin')
);

drop policy if exists dp_audit_log_read_policy on public.dp_audit_log;
create policy dp_audit_log_read_policy
on public.dp_audit_log for select
using (public.current_app_role() in ('hr', 'admin', 'superadmin'));

drop policy if exists dp_audit_log_write_policy on public.dp_audit_log;
create policy dp_audit_log_write_policy
on public.dp_audit_log for insert
with check (
  auth.role() = 'service_role'
  or public.current_app_role() in ('admin', 'superadmin')
);
