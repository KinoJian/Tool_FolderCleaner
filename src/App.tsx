import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from './components/SectionCard';
import { StatCard } from './components/StatCard';
import { dashboardSummary, defaultSettings, plannedTasks, previewSkeleton } from './lib/defaults';
import { deletePaths, isTauriRuntime, loadSettings, pickDirectory, saveSettings, scanFolders } from './lib/tauri';
import type {
  AppSettings,
  DeleteMode,
  ExecutionMode,
  ScanFolderRow,
  ScanSummary,
  ScheduleFrequency,
} from './types/settings';

function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saveState, setSaveState] = useState('尚未保存');
  const [browseState, setBrowseState] = useState('等待桌面环境');
  const [scanState, setScanState] = useState('尚未扫描');
  const [isScanning, setIsScanning] = useState(false);
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [scanRows, setScanRows] = useState<ScanFolderRow[]>([]);
  const [pendingCleanupPaths, setPendingCleanupPaths] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const persisted = await loadSettings();
      if (persisted && mounted) {
        setSettings(persisted);
        setSaveState('已从本地配置恢复');
      }
    }

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const extensionText = useMemo(() => settings.extensions.join(', '), [settings.extensions]);
  const totalReclaimableBytes = useMemo(
    () => scanRows.reduce((sum, row) => sum + row.reclaimableBytes, 0),
    [scanRows],
  );
  const summaryCards = useMemo(() => {
    if (!scanSummary) {
      return dashboardSummary;
    }

    return [
      { label: '总文件数', value: scanSummary.totalFiles.toLocaleString('zh-CN'), hint: '扫描根目录下全部文件' },
      {
        label: '匹配文件数',
        value: scanSummary.matchingFiles.toLocaleString('zh-CN'),
        hint: '按扩展名白名单过滤后的文件数',
      },
      {
        label: '命中文件夹数',
        value: scanSummary.matchedFolders.toLocaleString('zh-CN'),
        hint: '名称精确命中的目标文件夹',
      },
      {
        label: '预计释放空间',
        value: formatBytes(totalReclaimableBytes),
        hint: '基于当前稀疏保留规则的预估清理体积',
      },
    ];
  }, [scanSummary, totalReclaimableBytes]);
  const displayedRows = scanRows.length > 0 ? scanRows : previewSkeleton;

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setSaveState('配置已修改，等待保存');
  }

  async function handleBrowseRootDirectory() {
    const selected = await pickDirectory();
    if (selected) {
      updateSetting('rootDirectory', selected);
      setBrowseState('已通过系统目录对话框选择');
      return;
    }

    setBrowseState(
      isTauriRuntime()
        ? '未选择目录'
        : '当前为浏览器预览环境，目录选择按钮需在 Tauri 桌面壳中使用',
    );
  }

  async function handleSaveSettings() {
    await saveSettings(settings);
    setSaveState(isTauriRuntime() ? '已写入本地 settings.json' : '浏览器预览模式下仅更新界面状态');
  }

  async function handleScanFolders() {
    if (!settings.rootDirectory.trim()) {
      setScanState('请先选择扫描根目录');
      return;
    }

    setIsScanning(true);
    setScanState('正在扫描目录...');

    try {
      const result = await scanFolders(settings);
      if (!result) {
        setScanState('当前为浏览器预览环境，需在 Tauri 桌面壳中执行真实扫描');
        return;
      }

      setScanSummary(result.summary);
      setScanRows(result.folders);
      setPendingCleanupPaths(result.cleanupPaths);

      if (result.summary.matchedFolders === 0) {
        setScanState('扫描完成，但未找到匹配的目标文件夹');
        return;
      }

      if (settings.executionMode === 'auto' && result.cleanupPaths.length > 0) {
        await executeCleanup(result.cleanupPaths, true);
        return;
      }

      if (result.cleanupPaths.length > 0) {
        setScanState(
          `扫描完成，已找到 ${result.summary.matchedFolders} 个目标文件夹，待清理 ${result.cleanupPaths.length} 个文件`,
        );
      } else {
        setScanState(`扫描完成，已找到 ${result.summary.matchedFolders} 个目标文件夹，但当前无需清理`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setScanState(`扫描失败：${message}`);
    } finally {
      setIsScanning(false);
    }
  }

  async function executeCleanup(paths: string[], isAutoRun = false) {
    if (paths.length === 0) {
      setScanState('当前没有可清理文件');
      return;
    }

    setIsExecutingCleanup(true);
    setScanState(isAutoRun ? '自动执行清理中...' : '正在执行清理...');

    try {
      await deletePaths(paths, settings.deleteMode);
      setPendingCleanupPaths([]);
      setScanState(
        `${isAutoRun ? '自动' : '手动'}清理完成，已处理 ${paths.length} 个文件（模式：${
          settings.deleteMode === 'recycle-bin' ? '移入回收站' : '彻底删除'
        }）`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setScanState(`执行清理失败：${message}`);
    } finally {
      setIsExecutingCleanup(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Task 1 / Desktop Shell Scaffold</span>
          <h1>Folder Cleaner Dashboard</h1>
          <p>
            基于 Tauri + React/Vite 的单页仪表盘骨架，已预留目录选择、规则配置、统计、扫描结果和计划任务五大区域。
          </p>
        </div>
        <div className="hero-meta">
          <span>运行时：{isTauriRuntime() ? 'Tauri 桌面壳' : '浏览器预览'}</span>
          <span>配置状态：{saveState}</span>
          <span>目录状态：{browseState}</span>
          <span>扫描状态：{scanState}</span>
        </div>
      </header>

      <section className="dashboard-grid top-grid">
        <SectionCard
          title="目录选择"
          description="选择扫描根目录，并指定需要精确命中的目标文件夹名。"
          actions={
            <button type="button" className="primary-button" onClick={handleBrowseRootDirectory}>
              浏览...
            </button>
          }
        >
          <div className="form-grid">
            <label>
              <span>扫描根目录</span>
              <input
                value={settings.rootDirectory}
                onChange={(event) => updateSetting('rootDirectory', event.target.value)}
                placeholder="例如 D:\\ProjectAssets"
              />
            </label>
            <label>
              <span>目标文件夹名</span>
              <input
                value={settings.targetFolderName}
                onChange={(event) => updateSetting('targetFolderName', event.target.value)}
                placeholder="unity"
              />
            </label>
          </div>
          <p className="muted-text">后续 Task 2 将基于该目录递归查找名称恰好等于目标文件夹名的子目录。</p>
        </SectionCard>

        <SectionCard
          title="规则区"
          description="集中配置扩展名白名单、每组最大保留数量、执行模式和删除模式。"
          actions={
            <button type="button" className="secondary-button" onClick={handleSaveSettings}>
              保存设置
            </button>
          }
        >
          <div className="form-grid rule-grid">
            <label>
              <span>扩展名白名单</span>
              <input
                value={extensionText}
                onChange={(event) =>
                  updateSetting(
                    'extensions',
                    event.target.value
                      .split(',')
                      .map((item) => item.trim().replace(/^\./, ''))
                      .filter(Boolean),
                  )
                }
                placeholder="mp4, mov, mxf"
              />
            </label>
            <label>
              <span>每组最大保留数量</span>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxVersionsPerShot}
                onChange={(event) => updateSetting('maxVersionsPerShot', Number(event.target.value) || 1)}
              />
            </label>
            <label>
              <span>执行模式</span>
              <select
                value={settings.executionMode}
                onChange={(event) => updateSetting('executionMode', event.target.value as ExecutionMode)}
              >
                <option value="preview">先预览后确认</option>
                <option value="auto">自动执行</option>
              </select>
            </label>
            <label>
              <span>删除模式</span>
              <select
                value={settings.deleteMode}
                onChange={(event) => updateSetting('deleteMode', event.target.value as DeleteMode)}
              >
                <option value="recycle-bin">移入回收站</option>
                <option value="permanent">彻底删除</option>
              </select>
            </label>
            <label>
              <span>计划任务频率</span>
              <select
                value={settings.scheduleFrequency}
                onChange={(event) => updateSetting('scheduleFrequency', event.target.value as ScheduleFrequency)}
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
              </select>
            </label>
            <label>
              <span>回收站提醒阈值 (GB)</span>
              <input
                type="number"
                min={1}
                value={settings.recycleBinReminderGb}
                onChange={(event) => updateSetting('recycleBinReminderGb', Number(event.target.value) || 1)}
              />
            </label>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="统计区"
        description="Task 2-3 已接入真实扫描统计，并基于镜头组规则预估可清理体积。"
      >
        <div className="stats-grid">
          {summaryCards.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
          ))}
        </div>
      </SectionCard>

      <section className="dashboard-grid bottom-grid">
        <SectionCard
          title="扫描结果区"
          description="当前已展示目标文件夹统计、镜头组数量、建议保留/清理数量和预计释放空间。"
          actions={
            <div className="panel-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={
                  isScanning ||
                  isExecutingCleanup ||
                  settings.executionMode !== 'preview' ||
                  pendingCleanupPaths.length === 0
                }
                onClick={() => void executeCleanup(pendingCleanupPaths)}
              >
                {isExecutingCleanup ? '清理中...' : '执行清理'}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isScanning || isExecutingCleanup || !settings.rootDirectory.trim()}
                onClick={handleScanFolders}
              >
                {isScanning ? '扫描中...' : '开始扫描'}
              </button>
            </div>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>目标文件夹</th>
                  <th>文件总数</th>
                  <th>匹配文件数</th>
                  <th>镜头组</th>
                  <th>建议保留</th>
                  <th>建议清理</th>
                  <th>预计释放</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={row.folder}>
                    <td>{row.folder}</td>
                    <td>{row.totalFiles.toLocaleString('zh-CN')}</td>
                    <td>{row.matchingFiles.toLocaleString('zh-CN')}</td>
                    <td>{row.shotGroups.toLocaleString('zh-CN')}</td>
                    <td>{row.keepCount.toLocaleString('zh-CN')}</td>
                    <td>{row.cleanupCount.toLocaleString('zh-CN')}</td>
                    <td>{formatBytes(row.reclaimableBytes)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="计划任务区"
          description="保留每日/每周任务的呈现位置，Task 6 将补充创建、编辑、启停与运行记录。"
        >
          <div className="task-list">
            {plannedTasks.map((task) => (
              <article key={task.name} className="task-card">
                <header>
                  <strong>{task.name}</strong>
                  <span>{task.status}</span>
                </header>
                <p>频率：{task.frequency}</p>
                <p>模式：{task.mode}</p>
                <p>下次运行：{task.nextRun}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="本地能力边界"
        description="Task 1 已把后续需要的桌面能力接口定义清楚，避免 Task 2 之后再返工壳层结构。"
      >
        <div className="capability-grid">
          <article>
            <h3>文件访问</h3>
            <p>通过 `@tauri-apps/plugin-dialog` 打开系统目录选择器，前端只持有根目录路径，实际递归扫描由后续 Rust 端命令实现。</p>
          </article>
          <article>
            <h3>删除能力</h3>
            <p>统一经由 `delete_paths` 命令调用 Rust 执行，支持回收站和彻底删除两种模式，避免前端直接碰本地文件系统。</p>
          </article>
          <article>
            <h3>设置持久化</h3>
            <p>通过 `load_settings` / `save_settings` 命令读写应用配置目录下的 `settings.json`，用于恢复目录、规则与计划任务基础选项。</p>
          </article>
        </div>
      </SectionCard>
    </main>
  );
}

function formatBytes(value: number): string {
  if (value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default App;
