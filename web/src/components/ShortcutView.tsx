import type { ShortcutRecord } from '@agent-lite/core/shortcut'
export function ShortcutView({ record, running, onReplay }: { record?: ShortcutRecord; running: boolean; onReplay(): void }) {
  if (!record) return <section className="center shortcut-view"><div className="sv-empty">shortcut 不存在（可能已删除）</div></section>
  return (
    <section className="center shortcut-view">
      <h2>{record.name}</h2>
      <dl className="sv-meta">
        <div><dt>原始提问</dt><dd>{record.prompt}</dd></div>
        <div><dt>创建时间</dt><dd>{new Date(record.createdAt).toLocaleString()}</dd></div>
        <div><dt>步骤数</dt><dd>{record.steps.length}（{record.tools.join(' → ')}）</dd></div>
      </dl>
      <div className="sv-note">回放零 LLM：直接按录制的工具序列重查 live 数据并渲染。</div>
      <button className="sv-run" onClick={onReplay} disabled={running}>{running ? '回放中…' : '▶ 回放'}</button>
    </section>
  )
}
