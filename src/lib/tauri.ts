import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { AppSettings, DeleteMode } from '../types/settings';

const hasWindow = typeof window !== 'undefined';

export function isTauriRuntime(): boolean {
  return hasWindow && '__TAURI_INTERNALS__' in window;
}

export async function pickDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择扫描根目录',
  });

  return typeof selected === 'string' ? selected : null;
}

export async function loadSettings(): Promise<AppSettings | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<AppSettings>('load_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke('save_settings', { settings });
}

export async function deletePaths(paths: string[], mode: DeleteMode): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke('delete_paths', { request: { paths, mode } });
}
