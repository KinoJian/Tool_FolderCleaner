#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{delete_paths, load_settings, save_settings};

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![load_settings, save_settings, delete_paths])
    .run(tauri::generate_context!())
    .expect("error while running Tauri application");
}
