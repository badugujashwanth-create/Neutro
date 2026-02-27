use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrisisStatus {
  pub enabled: bool,
  pub duration_minutes: u32,
  pub blocked_apps: Vec<String>,
  pub message: String,
}

#[derive(Debug)]
pub struct CrisisRuntime {
  pub enabled: bool,
  pub duration_minutes: u32,
  pub blocked_apps: Vec<String>,
  pub message: String,
}

impl Default for CrisisRuntime {
  fn default() -> Self {
    Self {
      enabled: false,
      duration_minutes: 0,
      blocked_apps: Vec::new(),
      message: "Crisis mode inactive".to_string(),
    }
  }
}

impl CrisisRuntime {
  pub fn status(&self) -> CrisisStatus {
    CrisisStatus {
      enabled: self.enabled,
      duration_minutes: self.duration_minutes,
      blocked_apps: self.blocked_apps.clone(),
      message: self.message.clone(),
    }
  }
}

pub fn set_mode(runtime: &mut CrisisRuntime, enabled: bool, duration_minutes: u32) -> CrisisStatus {
  runtime.enabled = enabled;
  runtime.duration_minutes = duration_minutes;
  runtime.message = if enabled {
    format!("Focus mode enabled for {} minutes", duration_minutes)
  } else {
    "Crisis mode disabled".to_string()
  };
  runtime.status()
}

pub fn set_blocked_apps(runtime: &mut CrisisRuntime, apps: Vec<String>) -> CrisisStatus {
  runtime.blocked_apps = apps;
  runtime.message = "Blocked app list updated".to_string();
  runtime.status()
}

pub fn app_is_blocked(runtime: &CrisisRuntime, app_name: &str) -> bool {
  let lower = app_name.to_lowercase();
  runtime
    .blocked_apps
    .iter()
    .any(|blocked| lower.contains(&blocked.to_lowercase()))
}

#[cfg(target_os = "windows")]
pub fn minimize_active_window() -> bool {
  use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, ShowWindow, SW_MINIMIZE};
  unsafe {
    let hwnd = GetForegroundWindow();
    if hwnd.0.is_null() {
      return false;
    }
    let _ = ShowWindow(hwnd, SW_MINIMIZE);
    true
  }
}

#[cfg(not(target_os = "windows"))]
pub fn minimize_active_window() -> bool {
  false
}

pub fn attempt_os_dnd(enabled: bool) -> (bool, String) {
  if cfg!(target_os = "windows") {
    return (
      false,
      if enabled {
        "OS DND API not directly available here, using overlay only".to_string()
      } else {
        "Focus assist integration unavailable, overlay disabled".to_string()
      },
    );
  }

  (
    false,
    "OS DND not supported on this platform in MVP, using overlay only".to_string(),
  )
}
