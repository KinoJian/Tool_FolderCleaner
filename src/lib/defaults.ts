import type { AppSettings, PlannedTask, ScanPreviewRow, SummaryMetric } from '../types/settings';

export const defaultSettings: AppSettings = {
  rootDirectory: '',
  targetFolderName: 'unity',
  extensions: ['mp4', 'mov', 'mxf'],
  maxVersionsPerShot: 3,
  executionMode: 'preview',
  deleteMode: 'recycle-bin',
  scheduleEnabled: true,
  scheduleFrequency: 'daily',
  recycleBinReminderGb: 20,
};

export const dashboardSummary: SummaryMetric[] = [
  { label: '总文件数', value: '--', hint: 'Task 2 接入递归统计' },
  { label: '匹配文件数', value: '--', hint: '按扩展名白名单过滤' },
  { label: '命中文件夹数', value: '--', hint: '精确文件夹名发现' },
  { label: '预计释放空间', value: '--', hint: 'Task 4 输出预览后回填' },
];

export const previewSkeleton: ScanPreviewRow[] = [
  {
    folder: 'D:\\Project\\Episode01\\Shot010\\unity',
    shotGroups: 12,
    keepCount: 36,
    cleanupCount: 18,
    reclaimable: '28.4 GB',
    status: '等待 Task 2-4 接入真实扫描',
  },
  {
    folder: 'D:\\Project\\Episode02\\Shot070\\unity',
    shotGroups: 8,
    keepCount: 24,
    cleanupCount: 11,
    reclaimable: '16.7 GB',
    status: '骨架示例数据',
  },
];

export const plannedTasks: PlannedTask[] = [
  {
    name: '每日 unity 目录预览',
    frequency: '每日 09:00',
    mode: '先预览后确认',
    nextRun: '应用运行后计算',
    status: '已设计，待 Task 6 接入调度器',
  },
  {
    name: '周末自动清理归档目录',
    frequency: '每周日 21:00',
    mode: '自动执行',
    nextRun: '应用运行后计算',
    status: '骨架数据',
  },
];
