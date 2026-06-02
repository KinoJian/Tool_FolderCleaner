export type ExecutionMode = 'preview' | 'auto';
export type DeleteMode = 'recycle-bin' | 'permanent';
export type ScheduleFrequency = 'daily' | 'weekly';

export interface AppSettings {
  rootDirectory: string;
  targetFolderName: string;
  extensions: string[];
  maxVersionsPerShot: number;
  executionMode: ExecutionMode;
  deleteMode: DeleteMode;
  scheduleEnabled: boolean;
  scheduleFrequency: ScheduleFrequency;
  recycleBinReminderGb: number;
}

export interface SummaryMetric {
  label: string;
  value: string;
  hint: string;
}

export interface ScanSummary {
  totalFiles: number;
  matchingFiles: number;
  matchedFolders: number;
}

export interface ScanFolderRow {
  folder: string;
  totalFiles: number;
  matchingFiles: number;
  shotGroups: number;
  keepCount: number;
  cleanupCount: number;
  reclaimableBytes: number;
  status: string;
}

export interface ScanResult {
  summary: ScanSummary;
  folders: ScanFolderRow[];
  cleanupPaths: string[];
}

export interface PlannedTask {
  name: string;
  frequency: string;
  mode: string;
  nextRun: string;
  status: string;
}
