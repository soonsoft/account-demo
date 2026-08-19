import { useCallback, useRef, useState } from 'react'
import type { AgentEvent, Message } from '@agent-lite/core'
import { runSession } from '../../src/agent'
import { SCENARIOS } from '../../src/scenarios'
import { chatItemFromEvent, type ChatItem, stepItemFromEvent, newRunGroup, type RunGroup } from './events'
import { ChatView } from './components/ChatView'
import { Nav } from './components/Nav'
import { StepsPanel } from './components/StepsPanel'
import './styles.css'

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://127.0.0.1:3000/llm'

export function App() {
  const [messages, setMessages] = useState<Message[]>([])          // agent 上下文（多轮）
  const [chat, setChat] = useState<ChatItem[]>([])                 // 聊天时间线（渲染用）
  const [groups, setGroups] = useState<RunGroup[]>([])             // 步骤面板：按交互分组
  const [running, setRunning] = useState(false)
  const acRef = useRef<AbortController | null>(null)

  const onEvent = useCallback((e: AgentEvent) => {
    const ci = chatItemFromEvent(e); if (ci) setChat(c => [...c, ci])
    setGroups(gs => {
      if (!gs.length) return gs                                    // 事件总在 send 建组之后，防御而已
      const last = gs[gs.length - 1]!
      const next = [...gs]
      next[next.length - 1] = { ...last, steps: [...last.steps, stepItemFromEvent(e)] }
      return next
    })
  }, [])

  const send = useCallback(async (text: string) => {
    if (running || !text.trim()) return
    const userMsg: Message = { role: 'user', content: [{ type: 'text', text }] }
    const nextMessages = [...messages, userMsg]
    setChat(c => [...c, { kind: 'user', text }])
    setGroups(gs => [...gs, newRunGroup(text)])                    // 新交互 = 新组（视觉分隔由此而来）
    setMessages(nextMessages); setRunning(true)
    acRef.current = new AbortController()
    try {
      const { messages: fin } = await runSession({ messages: nextMessages, onEvent, gatewayUrl: GATEWAY_URL, signal: acRef.current.signal })
      setMessages(fin)                                             // 多轮续接
    } catch (e) {
      setChat(c => [...c, { kind: 'status', text: `⚠ 会话异常：${(e as Error).message}` }])
    } finally { setRunning(false); acRef.current = null }
  }, [messages, running, onEvent])

  const stop = useCallback(() => acRef.current?.abort(), [])

  return (
    <div className="app">
      <header>account-demo <span className="gw">{GATEWAY_URL}</span></header>
      <div className="body">
        <Nav shortcuts={[]} activeView="chat" onSelectChat={() => {}} onSelectShortcut={() => {}} onDeleteShortcut={() => {}} />
        <ChatView items={chat} running={running} showSave={false} onSave={() => {}} onSend={send} onStop={stop} scenarios={SCENARIOS} />
        <StepsPanel groups={groups} />
      </div>
    </div>
  )
}
