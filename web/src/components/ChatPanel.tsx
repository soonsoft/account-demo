import { useEffect, useRef } from 'react'
import type { ChatItem } from '../events'
export function ChatPanel({ items, running }: { items: ChatItem[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  // 新内容到达时滚到底部（demo 用无条件滚动；用户上翻时会被拉回，可接受）
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [items.length, running])
  return (
    <div className="chat" ref={ref}>
      {items.map((it, i) => {
        if (it.kind === 'user') return <div key={i} className="bubble user">{it.text}</div>
        if (it.kind === 'assistant') return <div key={i} className="bubble assistant">{it.text}</div>
        if (it.kind === 'render') return <div key={i} className="render" dangerouslySetInnerHTML={{ __html: it.html }} />
        return <div key={i} className="status">{it.text}</div>
      })}
      {running && <div className="bubble assistant pending">agent 运行中…</div>}
    </div>
  )
}
