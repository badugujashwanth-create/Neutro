use chrono::Utc;
use std::path::Path;

use crate::metrics::{self, MetricAccumulator, TelemetrySnapshot};

#[derive(Debug)]
pub struct TelemetryRuntime {
  pub consented: bool,
  pub running: bool,
  pub paused: bool,
  pub metrics: MetricAccumulator,
}

impl Default for TelemetryRuntime {
  fn default() -> Self {
    Self {
      consented: false,
      running: false,
      paused: false,
      metrics: MetricAccumulator::default(),
    }
  }
}

impl TelemetryRuntime {
  pub fn snapshot(&mut self) -> TelemetrySnapshot {
    metrics::snapshot(&mut self.metrics, self.running, self.paused, self.consented)
  }
}

#[cfg(target_os = "windows")]
fn get_active_window_info_windows() -> Option<(String, String)> {
  use windows::core::PWSTR;
  use windows::Win32::Foundation::CloseHandle;
  use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
  };
  use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};

  unsafe {
    let hwnd = GetForegroundWindow();
    if hwnd.0.is_null() {
      return None;
    }

    let mut title_buffer = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, &mut title_buffer);
    let title = if title_len > 0 {
      String::from_utf16_lossy(&title_buffer[..title_len as usize])
    } else {
      "Untitled".to_string()
    };

    let mut process_id = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    if process_id == 0 {
      return Some(("UnknownApp".to_string(), title));
    }

    let process_handle = match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) {
      Ok(handle) => handle,
      Err(_) => return Some(("UnknownApp".to_string(), title)),
    };

    let mut path_buffer = [0u16; 512];
    let mut size = path_buffer.len() as u32;
    let app_name = if QueryFullProcessImageNameW(
      process_handle,
      PROCESS_NAME_FORMAT(0),
      PWSTR(path_buffer.as_mut_ptr()),
      &mut size,
    )
    .is_ok()
      && size > 0
    {
      let full_path = String::from_utf16_lossy(&path_buffer[..size as usize]);
      Path::new(&full_path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "UnknownApp".to_string())
    } else {
      "UnknownApp".to_string()
    };

    let _ = CloseHandle(process_handle);
    Some((app_name, title))
  }
}

#[cfg(not(target_os = "windows"))]
fn get_active_window_info_windows() -> Option<(String, String)> {
  None
}

pub fn poll_active_window() -> (String, String) {
  get_active_window_info_windows().unwrap_or_else(|| ("UnknownApp".to_string(), "Unknown Title".to_string()))
}

pub fn tick(runtime: &mut TelemetryRuntime) -> Option<TelemetrySnapshot> {
  if !runtime.running || runtime.paused || !runtime.consented {
    return None;
  }

  let (app_name, title) = poll_active_window();
  metrics::register_tick(&mut runtime.metrics, &app_name, &title, Utc::now());
  Some(runtime.snapshot())
}
