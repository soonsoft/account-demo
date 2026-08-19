import type { ReactNode } from 'react'
import { ChatPanel } from './ChatPanel'
import { Composer } from './Composer'
import type { ChatItem } from '../events'
export function ChatView({ items, running, showSave, onSave, onSend, onStop, scenarios, children }: {
  items: ChatItem[]; running: boolean; showSave: boolean; onSave(): void
  onSend(t: string): void; onStop(): void; scenarios: { name: string; query: string }[]; children?: ReactNode
}) {
  return (
    <section className="center">
      <ChatPanel items={items} running={running} />
      {showSave && <button className="save-btn" onClick={onSave}>💾 存为 shortcut</button>}
      <Composer running={running} onSend={onSend} onStop={onStop} scenarios={scenarios} />
      {children}
    </section>
  )
}
