use serde::{Deserialize, Serialize};
use std::{
  collections::{HashMap, HashSet},
  fs,
  path::{Path, PathBuf},
  time::UNIX_EPOCH,
};
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
  pub root_directory: String,
  pub target_folder_name: String,
  pub extensions: Vec<String>,
  pub max_versions_per_shot: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
  pub total_files: u64,
  pub matching_files: u64,
  pub matched_folders: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanResult {
  pub folder: String,
  pub total_files: u64,
  pub matching_files: u64,
  pub shot_groups: u64,
  pub keep_count: u64,
  pub cleanup_count: u64,
  pub reclaimable_bytes: u64,
  pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResponse {
  pub summary: ScanSummary,
  pub folders: Vec<FolderScanResult>,
  pub cleanup_paths: Vec<String>,
}

#[derive(Debug, Clone)]
struct ParsedVersionFile {
  path: String,
  shot_code: String,
  date_key: String,
  take: u32,
  modified_ms: u128,
  size: u64,
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

fn normalize_extensions(extensions: &[String]) -> HashSet<String> {
  extensions
    .iter()
    .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
    .filter(|value| !value.is_empty())
    .collect()
}

fn matches_extension(path: &Path, extensions: &HashSet<String>) -> bool {
  if extensions.is_empty() {
    return true;
  }

  path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| extensions.contains(&value.to_ascii_lowercase()))
    .unwrap_or(false)
}

fn count_files_in_tree(path: &Path, extensions: &HashSet<String>) -> Result<(u64, u64), String> {
  let mut total_files = 0;
  let mut matching_files = 0;

  for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let entry_path = entry.path();

    if entry_path.is_dir() {
      let (nested_total, nested_matching) = count_files_in_tree(&entry_path, extensions)?;
      total_files += nested_total;
      matching_files += nested_matching;
      continue;
    }

    if entry_path.is_file() {
      total_files += 1;
      if matches_extension(&entry_path, extensions) {
        matching_files += 1;
      }
    }
  }

  Ok((total_files, matching_files))
}

fn modified_millis(metadata: &fs::Metadata) -> u128 {
  metadata
    .modified()
    .ok()
    .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
    .map(|value| value.as_millis())
    .unwrap_or(0)
}

fn parse_version_file(path: &Path, metadata: &fs::Metadata) -> Option<ParsedVersionFile> {
  let stem = path.file_stem()?.to_str()?;
  let mut parts = stem.split('_');
  let shot_code = parts.next()?.trim();
  let date_key = parts.next()?.trim();
  let take_token = parts.next()?.trim();

  if shot_code.is_empty() || date_key.len() != 8 || !date_key.chars().all(|value| value.is_ascii_digit()) {
    return None;
  }

  let take_digits = take_token
    .chars()
    .take_while(|value| value.is_ascii_digit())
    .collect::<String>();
  let take = take_digits.parse::<u32>().ok()?;

  Some(ParsedVersionFile {
    path: path.display().to_string(),
    shot_code: shot_code.to_string(),
    date_key: date_key.to_string(),
    take,
    modified_ms: modified_millis(metadata),
    size: metadata.len(),
  })
}

fn collect_folder_stats(
  path: &Path,
  extensions: &HashSet<String>,
  parsed_files: &mut Vec<ParsedVersionFile>,
  total_files: &mut u64,
  matching_files: &mut u64,
) -> Result<(), String> {
  for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let entry_path = entry.path();

    if entry_path.is_dir() {
      collect_folder_stats(&entry_path, extensions, parsed_files, total_files, matching_files)?;
      continue;
    }

    if !entry_path.is_file() {
      continue;
    }

    *total_files += 1;
    if !matches_extension(&entry_path, extensions) {
      continue;
    }

    *matching_files += 1;
    let metadata = entry.metadata().map_err(|error| error.to_string())?;
    if let Some(parsed) = parse_version_file(&entry_path, &metadata) {
      parsed_files.push(parsed);
    }
  }

  Ok(())
}

fn sparse_keep_indices(length: usize, max_keep: usize) -> HashSet<usize> {
  let mut keep = HashSet::new();
  if length == 0 || max_keep == 0 {
    return keep;
  }

  if length <= max_keep {
    return (0..length).collect();
  }

  if max_keep == 1 {
    keep.insert(length - 1);
    return keep;
  }

  keep.insert(0);
  keep.insert(length - 1);

  if max_keep == 2 {
    return keep;
  }

  let middle_slots = max_keep - 2;
  let span = length - 1;

  for step in 1..=middle_slots {
    let index = ((step * span) as f64 / (middle_slots + 1) as f64).round() as usize;
    keep.insert(index.clamp(1, length - 2));
  }

  if keep.len() < max_keep {
    for index in 1..(length - 1) {
      keep.insert(index);
      if keep.len() == max_keep {
        break;
      }
    }
  }

  keep
}

fn analyze_shot_groups(files: Vec<ParsedVersionFile>, max_keep: usize) -> (u64, u64, u64, u64, Vec<String>) {
  let mut by_shot: HashMap<String, Vec<ParsedVersionFile>> = HashMap::new();
  for file in files {
    by_shot.entry(file.shot_code.clone()).or_default().push(file);
  }

  let mut keep_count = 0_u64;
  let mut cleanup_count = 0_u64;
  let mut reclaimable_bytes = 0_u64;
  let mut cleanup_paths = Vec::new();

  for shot_files in by_shot.values() {
    let mut latest_by_date: HashMap<String, ParsedVersionFile> = HashMap::new();

    for file in shot_files {
      if let Some(current) = latest_by_date.get_mut(&file.date_key) {
        let should_replace =
          file.take > current.take || (file.take == current.take && file.modified_ms > current.modified_ms);
        if should_replace {
          reclaimable_bytes += current.size;
          cleanup_count += 1;
          cleanup_paths.push(current.path.clone());
          *current = file.clone();
        } else {
          reclaimable_bytes += file.size;
          cleanup_count += 1;
          cleanup_paths.push(file.path.clone());
        }
      } else {
        latest_by_date.insert(file.date_key.clone(), file.clone());
      }
    }

    let mut effective_versions = latest_by_date.into_values().collect::<Vec<_>>();
    effective_versions.sort_by(|left, right| {
      left
        .modified_ms
        .cmp(&right.modified_ms)
        .then_with(|| left.date_key.cmp(&right.date_key))
        .then_with(|| left.take.cmp(&right.take))
    });

    let keep_indices = sparse_keep_indices(effective_versions.len(), max_keep);
    for (index, file) in effective_versions.iter().enumerate() {
      if keep_indices.contains(&index) {
        keep_count += 1;
      } else {
        cleanup_count += 1;
        reclaimable_bytes += file.size;
        cleanup_paths.push(file.path.clone());
      }
    }
  }

  (
    by_shot.len() as u64,
    keep_count,
    cleanup_count,
    reclaimable_bytes,
    cleanup_paths,
  )
}

fn analyze_target_folder(
  path: &Path,
  extensions: &HashSet<String>,
  max_versions_per_shot: usize,
) -> Result<(FolderScanResult, Vec<String>), String> {
  let mut parsed_files = Vec::new();
  let mut total_files = 0;
  let mut matching_files = 0;

  collect_folder_stats(
    path,
    extensions,
    &mut parsed_files,
    &mut total_files,
    &mut matching_files,
  )?;

  let (shot_groups, keep_count, cleanup_count, reclaimable_bytes, cleanup_paths) =
    analyze_shot_groups(parsed_files, max_versions_per_shot);

  let status = if matching_files == 0 {
    "已发现目标文件夹，但无符合扩展名的文件".into()
  } else if shot_groups == 0 {
    "已发现目标文件夹，但未识别出符合命名规则的镜头文件".into()
  } else {
    format!("已识别 {} 个镜头组", shot_groups)
  };

  Ok((
    FolderScanResult {
      folder: path.display().to_string(),
      total_files,
      matching_files,
      shot_groups,
      keep_count,
      cleanup_count,
      reclaimable_bytes,
      status,
    },
    cleanup_paths,
  ))
}

fn scan_root(
  path: &Path,
  target_folder_name: &str,
  extensions: &HashSet<String>,
  max_versions_per_shot: usize,
  summary: &mut ScanSummary,
  folders: &mut Vec<FolderScanResult>,
  cleanup_paths: &mut Vec<String>,
) -> Result<(), String> {
  for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let entry_path = entry.path();

    if entry_path.is_dir() {
      let name = entry.file_name();
      let name = name.to_string_lossy();
      if name.eq_ignore_ascii_case(target_folder_name) {
        let (folder_result, folder_cleanup_paths) = analyze_target_folder(
          &entry_path,
          extensions,
          max_versions_per_shot,
        )?;
        folders.push(folder_result);
        cleanup_paths.extend(folder_cleanup_paths);
        summary.matched_folders += 1;
      }

      scan_root(
        &entry_path,
        target_folder_name,
        extensions,
        max_versions_per_shot,
        summary,
        folders,
        cleanup_paths,
      )?;
      continue;
    }

    if entry_path.is_file() {
      summary.total_files += 1;
      if matches_extension(&entry_path, extensions) {
        summary.matching_files += 1;
      }
    }
  }

  Ok(())
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

#[tauri::command]
pub fn scan_folders(request: ScanRequest) -> Result<ScanResponse, String> {
  let root_path = PathBuf::from(&request.root_directory);
  if !root_path.exists() {
    return Err("扫描根目录不存在".into());
  }

  if !root_path.is_dir() {
    return Err("扫描根目录不是文件夹".into());
  }

  let target_folder_name = request.target_folder_name.trim();
  if target_folder_name.is_empty() {
    return Err("目标文件夹名不能为空".into());
  }

  let extensions = normalize_extensions(&request.extensions);
  let max_versions_per_shot = usize::from(request.max_versions_per_shot.max(1));
  let mut summary = ScanSummary {
    total_files: 0,
    matching_files: 0,
    matched_folders: 0,
  };
  let mut folders = Vec::new();
  let mut cleanup_paths = Vec::new();

  scan_root(
    &root_path,
    target_folder_name,
    &extensions,
    max_versions_per_shot,
    &mut summary,
    &mut folders,
    &mut cleanup_paths,
  )?;

  folders.sort_by(|left, right| left.folder.cmp(&right.folder));
  cleanup_paths.sort();

  Ok(ScanResponse {
    summary,
    folders,
    cleanup_paths,
  })
}
