use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRecord {
  pub app_name: String,
  pub start_time: String,
  pub duration_sec: u64,
  pub switch_count: u32,
  pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkSessionEvent {
  pub id: String,
  pub app_name: String,
  pub started_at: String,
  pub ended_at: String,
  pub duration_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySnapshot {
  pub telemetry_on: bool,
  pub paused: bool,
  pub consented: bool,
  pub active_app_name: String,
  pub active_title: String,
  pub focus_time_per_app: HashMap<String, u64>,
  pub context_switch_count_10m: u32,
  pub records: Vec<TelemetryRecord>,
  pub work_sessions: Vec<WorkSessionEvent>,
  pub timestamp: String,
}

#[derive(Debug)]
pub struct MetricAccumulator {
  pub active_app_name: String,
  pub active_title: String,
  pub active_started_at: DateTime<Utc>,
  pub active_continuous_sec: u64,
  pub focus_time_per_app: HashMap<String, u64>,
  pub records: VecDeque<TelemetryRecord>,
  pub switch_timestamps: VecDeque<DateTime<Utc>>,
  pub work_sessions: VecDeque<WorkSessionEvent>,
}

impl Default for MetricAccumulator {
  fn default() -> Self {
    Self {
      active_app_name: "Unknown".to_string(),
      active_title: String::new(),
      active_started_at: Utc::now(),
      active_continuous_sec: 0,
      focus_time_per_app: HashMap::new(),
      records: VecDeque::new(),
      switch_timestamps: VecDeque::new(),
      work_sessions: VecDeque::new(),
    }
  }
}

fn trim_old_switches(switch_timestamps: &mut VecDeque<DateTime<Utc>>) {
  let cutoff = Utc::now() - Duration::minutes(10);
  while let Some(front) = switch_timestamps.front() {
    if *front < cutoff {
      switch_timestamps.pop_front();
    } else {
      break;
    }
  }
}

pub fn register_tick(
  metrics: &mut MetricAccumulator,
  app_name: &str,
  title: &str,
  now: DateTime<Utc>,
) {
  let app_key = app_name.to_string();
  let focus_seconds = metrics.focus_time_per_app.entry(app_key.clone()).or_insert(0);
  *focus_seconds += 1;

  if metrics.active_app_name == "Unknown" && metrics.active_continuous_sec == 0 {
    metrics.active_app_name = app_key;
    metrics.active_title = title.to_string();
    metrics.active_started_at = now;
    metrics.active_continuous_sec = 1;
    return;
  }

  if metrics.active_app_name != app_name {
    let duration = (now - metrics.active_started_at).num_seconds().max(1) as u64;
    metrics.records.push_front(TelemetryRecord {
      app_name: metrics.active_app_name.clone(),
      start_time: metrics.active_started_at.to_rfc3339(),
      duration_sec: duration,
      switch_count: metrics.switch_timestamps.len() as u32,
      title: metrics.active_title.clone(),
    });

    if metrics.records.len() > 500 {
      metrics.records.pop_back();
    }

    metrics.switch_timestamps.push_back(now);
    trim_old_switches(&mut metrics.switch_timestamps);

    if metrics.active_continuous_sec >= 25 * 60 {
      metrics.work_sessions.push_front(WorkSessionEvent {
        id: format!("session-{}", now.timestamp_millis()),
        app_name: metrics.active_app_name.clone(),
        started_at: metrics.active_started_at.to_rfc3339(),
        ended_at: now.to_rfc3339(),
        duration_sec: metrics.active_continuous_sec,
      });
      if metrics.work_sessions.len() > 120 {
        metrics.work_sessions.pop_back();
      }
    }

    metrics.active_app_name = app_name.to_string();
    metrics.active_title = title.to_string();
    metrics.active_started_at = now;
    metrics.active_continuous_sec = 1;
    return;
  }

  metrics.active_title = title.to_string();
  metrics.active_continuous_sec += 1;
}

pub fn snapshot(metrics: &mut MetricAccumulator, telemetry_on: bool, paused: bool, consented: bool) -> TelemetrySnapshot {
  trim_old_switches(&mut metrics.switch_timestamps);

  TelemetrySnapshot {
    telemetry_on,
    paused,
    consented,
    active_app_name: metrics.active_app_name.clone(),
    active_title: metrics.active_title.clone(),
    focus_time_per_app: metrics.focus_time_per_app.clone(),
    context_switch_count_10m: metrics.switch_timestamps.len() as u32,
    records: metrics.records.iter().cloned().collect(),
    work_sessions: metrics.work_sessions.iter().cloned().collect(),
    timestamp: Utc::now().to_rfc3339(),
  }
}
