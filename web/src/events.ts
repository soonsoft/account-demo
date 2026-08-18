import type { AgentEvent } from '@agent-lite/core'

// 聊天区渲染用「时间线」，不直接渲染 Message[]：条目按发生顺序追加，天然交错 user/assistant/render/status。
export type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'render'; html: string }
  | { kind: 'status'; text: string }   // done / error / cancelled

export function chatItemFromEvent(e: AgentEvent): ChatItem | null {
  switch (e.type) {
    case 'text': return { kind: 'assistant', text: e.text }
    case 'present': return { kind: 'render', html: e.html }
    case 'done': return { kind: 'status', text: e.reason === 'completed' ? '✓ 已完成' : `⚠ ${e.reason === 'cancelled' ? '已取消' : '异常结束：' + e.reason}` }
    case 'error': return { kind: 'status', text: `⚠ ${(e.error as Error).message.slice(0, 120)}${e.recoverable ? '（可恢复）' : ''}` }
    default: return null   // tool/retry/turn 进步骤面板，不进聊天区
  }
}

// 步骤面板条目（全事件，含 meta）
export type StepItem = { icon: string; text: string; error?: boolean }

// 步骤面板按「一次用户交互（run）」分组：组头是用户查询，组内是该 run 的步骤。
export interface RunGroup { userText: string; steps: StepItem[] }
export function newRunGroup(userText: string): RunGroup { return { userText, steps: [] } }
export function stepItemFromEvent(e: AgentEvent): StepItem {
  switch (e.type) {
    case 'turn_start': return { icon: '→', text: `turn ${e.turn}（${e.phase}）` }
    case 'turn_end': return { icon: '·', text: `turn ${e.turn} 结束` }
    case 'phase_changed': return { icon: '⇆', text: `phase ${e.from} → ${e.to}` }
    case 'retry': return { icon: '↻', text: `重试 ${e.attempt}/${e.maxAttempts}：${(e.error as Error).message.slice(0, 60)}` }
    case 'tool_call': return { icon: '▸', text: `${e.name}(${JSON.stringify(e.input).slice(0, 100)})` }
    case 'tool_result': return { icon: e.is_error ? '✗' : '◂', text: `${e.is_error ? 'ERROR' : 'ok'}${e.summary ? '：' + e.summary : ''}`, error: e.is_error }
    case 'text': return { icon: '💬', text: e.text.slice(0, 80) }
    case 'present': return { icon: '🖥', text: '渲染结果已生成' }
    case 'error': return { icon: '⚠', text: `错误：${(e.error as Error).message.slice(0, 100)}`, error: true }
    case 'done': return { icon: '✓', text: `结束：${e.reason}` }
  }
}
