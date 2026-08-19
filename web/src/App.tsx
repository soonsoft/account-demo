import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentEvent, Message } from '@agent-lite/core'
import type { ShortcutRecord } from '@agent-lite/core/shortcut'
import { runSession } from '../../src/agent'
import { SCENARIOS } from '../../src/scenarios'
import { chatItemFromEvent, type ChatItem, stepItemFromEvent, newRunGroup, type RunGroup } from './events'
import { ChatView } from './components/ChatView'
import { ShortcutView } from './components/ShortcutView'
import { Nav } from './components/Nav'
import { StepsPanel } from './components/StepsPanel'
import { listShortcuts, deleteShortcut, recordShortcut, saveShortcut, replayShortcut } from './shortcut'
import './styles.css'

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://127.0.0.1:3000/llm'

export function App() {
  const [messages, setMessages] = useState<Message[]>([])          // agent 上下文（多轮）
  const [chat, setChat] = useState<ChatItem[]>([])                 // 聊天时间线（渲染用）
  const [groups, setGroups] = useState<RunGroup[]>([])             // 步骤面板：按交互分组
  const [running, setRunning] = useState(false)
  const acRef = useRef<AbortController | null>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutRecord[]>([])  // IndexedDB 里的 shortcut 记录
  const [view, setView] = useState<'chat' | 'shortcut'>('chat')
  const [activeShortcutId, setActiveShortcutId] = useState<string | undefined>()
  // 来源隔离：chat 运行留存原始事件供「存为 shortcut」；replay 只展示、不进缓冲、不武装保存按钮
  const lastEventsRef = useRef<AgentEvent[]>([])
  const lastPromptRef = useRef('')
  const modeRef = useRef<'chat' | 'replay'>('chat')
  const [lastRunCompleted, setLastRunCompleted] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { listShortcuts().then(setShortcuts).catch(() => {}) }, [])

  const onEvent = useCallback((e: AgentEvent) => {
    const ci = chatItemFromEvent(e); if (ci) setChat(c => [...c, ci])
    setGroups(gs => {
      if (!gs.length) return gs                                    // 事件总在 send 建组之后，防御而已
      const last = gs[gs.length - 1]!
      const next = [...gs]
      next[next.length - 1] = { ...last, steps: [...last.steps, stepItemFromEvent(e)] }
      return next
    })
    if (modeRef.current === 'chat') {
      lastEventsRef.current.push(e)
      if (e.type === 'done' && e.reason === 'completed') setLastRunCompleted(true)
    }
  }, [])

  const send = useCallback(async (text: string) => {
    if (running || !text.trim()) return
    modeRef.current = 'chat'; lastEventsRef.current = []; lastPromptRef.current = text; setLastRunCompleted(false)
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

  const saveShortcutFromLastRun = useCallback(async () => {
    const name = window.prompt('shortcut 名称', lastPromptRef.current.slice(0, 12) || 'shortcut')
    if (!name) return
    const rec = recordShortcut(lastEventsRef.current, name, lastPromptRef.current)
    await saveShortcut(rec)
    setShortcuts(await listShortcuts())
    setToast('已保存到左栏 Shortcuts'); setTimeout(() => setToast(''), 2000)
  }, [])

  const runReplay = useCallback(async (record: ShortcutRecord) => {
    if (running) return
    setView('chat')                                                 // 输出在共享时间线看（spec 消歧）
    setGroups(gs => [...gs, newRunGroup(`⚡ ${record.name}（回放，零 LLM）`)])
    setRunning(true); modeRef.current = 'replay'; acRef.current = new AbortController()
    try {
      for await (const e of replayShortcut(record, acRef.current.signal)) onEvent(e)
    } catch (e) {
      setChat(c => [...c, { kind: 'status', text: `⚠ 回放异常：${(e as Error).message}` }])
    } finally { setRunning(false); acRef.current = null }
  }, [running, onEvent])

  const selectChat = () => setView('chat')
  const selectShortcut = (id: string) => { setActiveShortcutId(id); setView('shortcut') }
  const removeShortcut = async (id: string) => {
    if (!window.confirm('删除该 shortcut？')) return
    await deleteShortcut(id)
    setShortcuts(await listShortcuts())
    if (activeShortcutId === id) { setActiveShortcutId(undefined); setView('chat') }   // 删当前打开的 → 回退对话 view
  }

  return (
    <div className="app">
      <header>account-demo <span className="gw">{GATEWAY_URL}</span></header>
      <div className="body">
        <Nav shortcuts={shortcuts} activeView={view} activeShortcutId={activeShortcutId} onSelectChat={selectChat} onSelectShortcut={selectShortcut} onDeleteShortcut={removeShortcut} />
        {view === 'chat'
          ? <ChatView items={chat} running={running} showSave={lastRunCompleted && !running} onSave={saveShortcutFromLastRun} onSend={send} onStop={stop} scenarios={SCENARIOS}>{toast && <div className="toast">{toast}</div>}</ChatView>
          : <ShortcutView record={shortcuts.find(s => s.id === activeShortcutId)} running={running} onReplay={() => { const rec = shortcuts.find(s => s.id === activeShortcutId); if (rec) runReplay(rec) }} />}
        <StepsPanel groups={groups} />
      </div>
    </div>
  )
}
