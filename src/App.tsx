import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from './components/SectionCard';
import { StatCard } from './components/StatCard';
import { dashboardSummary, defaultSettings, plannedTasks, previewSkeleton } from './lib/defaults';
import { isTauriRuntime, loadSettings, pickDirectory, saveSettings } from './lib/tauri';
import type { AppSettings, DeleteMode, ExecutionMode, ScheduleFrequency } from './types/settings';

function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saveState, setSaveState] = useState('尚未保存');
  const [browseState, setBrowseState] = useState('等待桌面环境');

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
        description="当前展示 Task 2 将回填的核心统计指标。"
      >
        <div className="stats-grid">
          {dashboardSummary.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
          ))}
        </div>
      </SectionCard>

      <section className="dashboard-grid bottom-grid">
        <SectionCard
          title="扫描结果区"
          description="Task 2-4 将把真实扫描、分组和预览结果挂到这里。"
          actions={
            <button type="button" className="primary-button" disabled>
              开始扫描（待 Task 2 接入）
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>目标文件夹</th>
                  <th>镜头组</th>
                  <th>建议保留</th>
                  <th>建议清理</th>
                  <th>预计释放</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {previewSkeleton.map((row) => (
                  <tr key={row.folder}>
                    <td>{row.folder}</td>
                    <td>{row.shotGroups}</td>
                    <td>{row.keepCount}</td>
                    <td>{row.cleanupCount}</td>
                    <td>{row.reclaimable}</td>
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

export default App;
