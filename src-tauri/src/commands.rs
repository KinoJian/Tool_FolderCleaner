use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub root_directory: String,
  pub target_folder_name: String,
  pub extensions: Vec<String>,
  pub max_versions_per_shot: u16,
  pub execution_mode: String,
  pub delete_mode: String,
  pub schedule_enabled: bool,
  pub schedule_frequency: String,
  pub recycle_bin_reminder_gb: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRequest {
  pub paths: Vec<String>,
  pub mode: String,
}

fn default_settings() -> AppSettings {
  AppSettings {
    root_directory: String::new(),
    target_folder_name: "unity".into(),
    extensions: vec!["mp4".into(), "mov".into(), "mxf".into()],
    max_versions_per_shot: 3,
    execution_mode: "preview".into(),
    delete_mode: "recycle-bin".into(),
    schedule_enabled: true,
    schedule_frequency: "daily".into(),
    recycle_bin_reminder_gb: 20,
  }
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
  let config_dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
  fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
  Ok(config_dir.join("settings.json"))
}

fn delete_path(path: &Path, mode: &str) -> Result<(), String> {
  match mode {
    "permanent" => {
      if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
      } else {
        fs::remove_file(path).map_err(|error| error.to_string())
      }
    }
    _ => trash::delete(path).map_err(|error| error.to_string()),
  }
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
  let file = settings_file(&app)?;
  if !file.exists() {
    return Ok(default_settings());
  }

  let content = fs::read_to_string(file).map_err(|error| error.to_string())?;
  serde_json::from_str(&content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
  let file = settings_file(&app)?;
  let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
  fs::write(file, content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_paths(request: DeleteRequest) -> Result<(), String> {
  for raw_path in request.paths {
    let path = PathBuf::from(raw_path);
    if path.exists() {
      delete_path(&path, &request.mode)?;
    }
  }

  Ok(())
}
