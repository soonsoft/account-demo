import { useState, type ReactNode } from 'react'
import { ChatPanel } from './ChatPanel'
import { Composer } from './Composer'
import type { ChatItem } from '../events'

export function ChatView({ items, running, showSave, onSave, defaultName, onSend, onStop, scenarios, children }: {
  items: ChatItem[]; running: boolean; showSave: boolean
  onSave(name: string): void; defaultName: string
  onSend(t: string): void; onStop(): void; scenarios: { name: string; query: string }[]; children?: ReactNode
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const startNaming = () => { setName(defaultName); setNaming(true) }
  const submit = () => { const n = name.trim(); if (n) { onSave(n); setNaming(false) } }

  return (
    <section className="center">
      <ChatPanel items={items} running={running} />
      {showSave && !naming && <button className="save-btn" onClick={startNaming}>💾 存为 shortcut</button>}
      {showSave && naming && (
        <div className="save-row">
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setNaming(false) }}
            placeholder="shortcut 名称" />
          <button className="save-ok" onClick={submit}>保存</button>
          <button className="save-cancel" onClick={() => setNaming(false)}>✕</button>
        </div>
      )}
      <Composer running={running} onSend={onSend} onStop={onStop} scenarios={scenarios} />
      {children}
    </section>
  )
}
