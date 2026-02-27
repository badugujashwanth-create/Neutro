#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod crisis;
mod dp;
mod metrics;
mod telemetry;

use crisis::CrisisRuntime;
use dp::{AggregateInput, AggregateResponse, DpRuntime};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use telemetry::TelemetryRuntime;

#[derive(Default)]
struct AppBrain {
  telemetry: TelemetryRuntime,
  crisis: CrisisRuntime,
  dp: DpRuntime,
}

#[derive(Clone)]
struct SharedState {
  inner: Arc<Mutex<AppBrain>>,
}

impl SharedState {
  fn new() -> Self {
    Self {
      inner: Arc::new(Mutex::new(AppBrain::default())),
    }
  }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
  status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OsDndResponse {
  supported: bool,
  message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MinimizeResponse {
  action_taken: bool,
  app_name: String,
}

fn emit_status(app: &AppHandle, status: &str) {
  let payload = StatusResponse {
    status: status.to_string(),
  };
  let _ = app.emit("telemetry://status", payload);
}

#[tauri::command]
fn telemetry_start(app: AppHandle, state: State<SharedState>, consented: bool) -> Result<StatusResponse, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for telemetry_start".to_string())?;

  if !consented {
    guard.telemetry.consented = false;
    guard.telemetry.running = false;
    guard.telemetry.paused = false;
    return Ok(StatusResponse {
      status: "consent_required".to_string(),
    });
  }

  guard.telemetry.consented = true;
  guard.telemetry.running = true;
  guard.telemetry.paused = false;
  drop(guard);

  emit_status(&app, "running");
  Ok(StatusResponse {
    status: "running".to_string(),
  })
}

#[tauri::command]
fn telemetry_pause(app: AppHandle, state: State<SharedState>, paused: bool) -> Result<StatusResponse, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for telemetry_pause".to_string())?;
  guard.telemetry.paused = paused;
  drop(guard);

  emit_status(&app, if paused { "paused" } else { "running" });
  Ok(StatusResponse {
    status: if paused {
      "paused".to_string()
    } else {
      "running".to_string()
    },
  })
}

#[tauri::command]
fn telemetry_stop(app: AppHandle, state: State<SharedState>) -> Result<StatusResponse, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for telemetry_stop".to_string())?;
  guard.telemetry.running = false;
  guard.telemetry.paused = false;
  drop(guard);

  emit_status(&app, "stopped");
  Ok(StatusResponse {
    status: "stopped".to_string(),
  })
}

#[tauri::command]
fn telemetry_snapshot(state: State<SharedState>) -> Result<metrics::TelemetrySnapshot, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for telemetry_snapshot".to_string())?;
  Ok(guard.telemetry.snapshot())
}

#[tauri::command]
fn crisis_set_mode(
  app: AppHandle,
  state: State<SharedState>,
  enabled: bool,
  duration_minutes: u32,
) -> Result<crisis::CrisisStatus, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for crisis_set_mode".to_string())?;
  let status = crisis::set_mode(&mut guard.crisis, enabled, duration_minutes);
  drop(guard);
  let _ = app.emit("crisis://status", &status);
  Ok(status)
}

#[tauri::command]
fn crisis_set_blocked_apps(
  app: AppHandle,
  state: State<SharedState>,
  apps: Vec<String>,
) -> Result<crisis::CrisisStatus, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for crisis_set_blocked_apps".to_string())?;
  let status = crisis::set_blocked_apps(&mut guard.crisis, apps);
  drop(guard);
  let _ = app.emit("crisis://status", &status);
  Ok(status)
}

#[tauri::command]
fn crisis_attempt_os_dnd(enabled: bool) -> Result<OsDndResponse, String> {
  let (supported, message) = crisis::attempt_os_dnd(enabled);
  Ok(OsDndResponse { supported, message })
}

#[tauri::command]
fn overlay_open(app: AppHandle, label: String, route: String, _opts: Option<serde_json::Value>) -> Result<StatusResponse, String> {
  if let Some(window) = app.get_webview_window(&label) {
    let _ = window.show();
    let _ = window.set_focus();
    return Ok(StatusResponse {
      status: "shown".to_string(),
    });
  }

  let route_fragment = route.trim_start_matches('/');
  let page = format!("index.html#/{}", route_fragment);
  let mut builder = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(page.into()))
    .always_on_top(true)
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .title("Neutro Overlay")
    .inner_size(460.0, 760.0);

  if label == "focus_overlay" {
    builder = builder.fullscreen(true);
  }

  builder
    .build()
    .map_err(|error| format!("Failed to open overlay window: {error}"))?;

  Ok(StatusResponse {
    status: "opened".to_string(),
  })
}

#[tauri::command]
fn overlay_close(app: AppHandle, label: String) -> Result<StatusResponse, String> {
  if let Some(window) = app.get_webview_window(&label) {
    let _ = window.close();
  }
  Ok(StatusResponse {
    status: "closed".to_string(),
  })
}

#[tauri::command]
fn minimize_active_if_blocked(app: AppHandle, state: State<SharedState>) -> Result<MinimizeResponse, String> {
  let (current_app, _) = telemetry::poll_active_window();
  let mut action_taken = false;

  {
    let guard = state
      .inner
      .lock()
      .map_err(|_| "Failed to lock state for minimize_active_if_blocked".to_string())?;

    if guard.crisis.enabled && crisis::app_is_blocked(&guard.crisis, &current_app) {
      action_taken = crisis::minimize_active_window();
    }
  }

  if !action_taken {
    let _ = app.emit(
      "crisis://warning",
      format!(
        "Could not minimize blocked app (or no blocked app active): {}",
        current_app
      ),
    );
  }

  Ok(MinimizeResponse {
    action_taken,
    app_name: current_app,
  })
}

#[tauri::command]
fn aggregate_metrics(state: State<SharedState>, input: AggregateInput) -> Result<AggregateResponse, String> {
  let mut guard = state
    .inner
    .lock()
    .map_err(|_| "Failed to lock state for aggregate_metrics".to_string())?;
  dp::aggregate(&mut guard.dp, &input)
}

fn start_background_worker(app: AppHandle, state: SharedState) {
  thread::spawn(move || loop {
    let mut tick_snapshot: Option<metrics::TelemetrySnapshot> = None;
    let mut crisis_warning: Option<String> = None;

    if let Ok(mut guard) = state.inner.lock() {
      tick_snapshot = telemetry::tick(&mut guard.telemetry);

      if let Some(snapshot) = &tick_snapshot {
        if guard.crisis.enabled && crisis::app_is_blocked(&guard.crisis, &snapshot.active_app_name) {
          let minimized = crisis::minimize_active_window();
          if !minimized {
            crisis_warning = Some(format!(
              "Blocked app detected: {}. Minimize fallback unavailable.",
              snapshot.active_app_name
            ));
          }
        }
      }
    }

    if let Some(snapshot) = tick_snapshot {
      let _ = app.emit("telemetry://tick", snapshot);
    }

    if let Some(message) = crisis_warning {
      let _ = app.emit("crisis://warning", message);
    }

    thread::sleep(Duration::from_secs(1));
  });
}

fn main() {
  let shared_state = SharedState::new();
  let worker_state = shared_state.clone();

  tauri::Builder::default()
    .manage(shared_state)
    .setup(move |app| {
      start_background_worker(app.handle().clone(), worker_state.clone());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      telemetry_start,
      telemetry_pause,
      telemetry_stop,
      telemetry_snapshot,
      crisis_set_mode,
      crisis_set_blocked_apps,
      crisis_attempt_os_dnd,
      overlay_open,
      overlay_close,
      minimize_active_if_blocked,
      aggregate_metrics,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
