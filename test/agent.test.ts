import { describe, it, expect } from 'vitest'
import { runSessionWithLlm } from '../src/agent'
import { ScriptedLLMClient } from '@agent-lite/core'
import type { AgentEvent, Message } from '@agent-lite/core'

async function drain(messages: Message[], llm: ScriptedLLMClient): Promise<{ events: AgentEvent[]; messages: Message[] }> {
  const events: AgentEvent[] = []
  const { messages: finalMessages } = await runSessionWithLlm({ messages, llm, onEvent: e => events.push(e) })
  return { events, messages: finalMessages }
}

describe('runSessionWithLlm (query→finalize→render)', () => {
  it('full flow: query → finalize → render → done, with present event', async () => {
    const llm = new ScriptedLLMClient([
      { content: [{ type: 'tool_use', id: 't1', name: 'query_parties', input: { kyc_status: 'PENDING' } }] },
      { content: [{ type: 'tool_use', id: 't2', name: 'finalize_data', input: { gathered: '2 pending parties' } }] },
      { content: [{ type: 'tool_use', id: 't3', name: 'render_table', input: { from: ['t1.parties'], columns: [{ path: 'display_name', title: '客户' }, { path: 'kyc_status', title: 'KYC' }] } }] },
      { content: [{ type: 'text', text: 'done' }] },
    ])
    const { events } = await drain([{ role: 'user', content: [{ type: 'text', text: '列出 KYC 待审核客户' }] }], llm)
    expect(events.some(e => e.type === 'tool_call' && e.name === 'query_parties')).toBe(true)
    expect(events.some(e => e.type === 'tool_call' && e.name === 'finalize_data')).toBe(true)
    expect(events.some(e => e.type === 'tool_call' && e.name === 'render_table')).toBe(true)
    const present = events.find(e => e.type === 'present') as any
    expect(present?.html).toContain('Bob Smith')
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'completed' })
  })

  it('multi-turn: returned messages include assistant + tool_result turns for continuation', async () => {
    const llm = new ScriptedLLMClient([
      { content: [{ type: 'tool_use', id: 't1', name: 'query_parties', input: { name: 'Alice' } }] },
      { content: [{ type: 'text', text: '查到了 Alice' }] },
    ])
    const { messages: finalMessages } = await drain([{ role: 'user', content: [{ type: 'text', text: '查 Alice' }] }], llm)
    expect(finalMessages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(finalMessages[1]!.content[0]).toMatchObject({ type: 'tool_use', id: 't1' })
    expect((finalMessages[2]!.content[0] as any).tool_use_id).toBe('t1')
  })
})
