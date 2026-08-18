import { useEffect, useRef, useState } from 'react'
import type { RunGroup } from '../events'

// 组头摘要：N 个工具 · M 次渲染 · 结束原因（从步骤里数出来，不额外存状态）
function groupSummary(g: RunGroup): string {
  const tools = g.steps.filter(s => s.icon === '▸').length
  const renders = g.steps.filter(s => s.icon === '🖥').length
  const done = g.steps.find(s => s.icon === '✓' || s.icon === '⚠')
  const err = g.steps.some(s => s.error)
  return `${tools} 工具${renders ? ` · ${renders} 渲染` : ''}${done ? ` · ${done.icon === '✓' ? done.text.replace('结束：', '') : done.text}` : ''}${err ? '' : ''}`
}

export function StepsPanel({ groups }: { groups: RunGroup[] }) {
  // 折叠状态按组索引；旧组默认折叠（历史收起），最新一组（可能还在跑）默认展开
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [groups.length, collapsed])

  return (
    <aside className="steps" ref={ref}>
      <h3>步骤</h3>
      {groups.map((g, gi) => {
        const isLast = gi === groups.length - 1
        const open = collapsed[gi] ?? isLast        // 默认：最新组展开，其余折叠
        return (
          <section key={gi} className="run-group">
            <button className="run-head" onClick={() => setCollapsed(c => ({ ...c, [gi]: !open }))}>
              <span className="run-caret">{open ? '▾' : '▸'}</span>
              <span className="run-q">{g.userText}</span>
              <span className="run-meta">{groupSummary(g)}</span>
            </button>
            {open && g.steps.map((it, i) => (
              <div key={i} className={it.error ? 'step err' : 'step'}><span>{it.icon}</span> {it.text}</div>
            ))}
          </section>
        )
      })}
    </aside>
  )
}
