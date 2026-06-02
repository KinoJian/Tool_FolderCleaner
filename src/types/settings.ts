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

export interface ScanPreviewRow {
  folder: string;
  shotGroups: number;
  keepCount: number;
  cleanupCount: number;
  reclaimable: string;
  status: string;
}

export interface PlannedTask {
  name: string;
  frequency: string;
  mode: string;
  nextRun: string;
  status: string;
}
