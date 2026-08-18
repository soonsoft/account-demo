import { describe, it, expect } from 'vitest'
import { MessageAccumulator } from '../src/message-accumulator'
import type { LLMClient, LLMRequest, LLMResponse, Tool, ToolContext, Message } from '@agent-lite/core'

// 一个可控的 LLM：按序吐预设响应
function scriptedLlm(responses: LLMResponse[]): LLMClient {
  let i = 0
  return {
    async chat(_req: LLMRequest): Promise<LLMResponse> {
      return responses[i++] ?? responses[responses.length - 1]!
    },
  }
}

// 一个可控的 tool：返回固定 data
function scriptedTool(name: string, data: unknown): Tool {
  return {
    name, kind: 'query', description: 'd', inputSchema: { type: 'object' }, responseSchema: { type: 'object' },
    async execute() { return { data } },
  }
}

function ctxFor(id: string): ToolContext {
  return { toolUseId: id, phase: 'query', signal: new AbortController().signal, resolve: () => undefined }
}

describe('MessageAccumulator', () => {
  it('assistant response captured as assistant message', async () => {
    const acc = new MessageAccumulator([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }])
    const llm = scriptedLlm([{ content: [{ type: 'text', text: 'hello' }] }])
    const wrapped = acc.wrapLlm(llm)
    await wrapped.chat({ messages: [], system: '', tools: [], model: 'm' })
    expect(acc.messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'hello' }] })
  })

  it('tool_results buffered per round and flushed as ONE user message on next chat', async () => {
    const acc = new MessageAccumulator([{ role: 'user', content: [{ type: 'text', text: 'go' }] }])
    const llm = scriptedLlm([
      { content: [{ type: 'tool_use', id: 't1', name: 'q', input: {} }, { type: 'tool_use', id: 't2', name: 'q', input: {} }] },
      { content: [{ type: 'text', text: 'done' }] },
    ])
    const wrappedLlm = acc.wrapLlm(llm)
    const q = scriptedTool('q', { rows: 42 })
    const wrappedTool = acc.wrapTool(q)

    await wrappedLlm.chat({ messages: [], system: '', tools: [], model: 'm' })  // turn1 assistant(2 tool_use)
    await wrappedTool.execute({}, ctxFor('t1'))
    await wrappedTool.execute({}, ctxFor('t2'))
    expect(acc.messages).toHaveLength(2)  // 还没 flush
    await wrappedLlm.chat({ messages: [], system: '', tools: [], model: 'm' })  // turn2 触发 flush
    expect(acc.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    const userTurn = acc.messages[2]!
    expect(userTurn.content).toHaveLength(2)  // 两个 tool_result 在同一条 user 消息
    expect((userTurn.content[0] as any).tool_use_id).toBe('t1')
    expect((userTurn.content[1] as any).tool_use_id).toBe('t2')
  })

  it('finalize flushes remaining tool_results (max_turns exit path)', async () => {
    const acc = new MessageAccumulator([{ role: 'user', content: [{ type: 'text', text: 'go' }] }])
    const llm = scriptedLlm([{ content: [{ type: 'tool_use', id: 't1', name: 'q', input: {} }] }])
    const wrappedLlm = acc.wrapLlm(llm)
    const wrappedTool = acc.wrapTool(scriptedTool('q', { x: 1 }))
    await wrappedLlm.chat({ messages: [], system: '', tools: [], model: 'm' })
    await wrappedTool.execute({}, ctxFor('t1'))
    acc.finalize()
    expect(acc.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect((acc.messages[2]!.content[0] as any).tool_use_id).toBe('t1')
  })

  it('query tool result content = JSON.stringify(data) (replicates ToolExecutor default)', async () => {
    const acc = new MessageAccumulator([])
    await acc.wrapTool(scriptedTool('q', { a: 1 })).execute({}, ctxFor('t9'))
    acc.finalize()
    const tr = acc.messages[0]!.content[0] as any
    expect(tr.type).toBe('tool_result')
    expect(tr.tool_use_id).toBe('t9')
    expect((tr.content[0])).toEqual({ type: 'text', text: JSON.stringify({ a: 1 }) })
  })

  it('is_error propagated into tool_result', async () => {
    const errTool: Tool = { name: 'e', kind: 'query', description: 'd', inputSchema: { type: 'object' }, responseSchema: { type: 'object' }, async execute() { return { is_error: true, toLLM: [{ type: 'text', text: 'boom' }] } } }
    const acc = new MessageAccumulator([])
    await acc.wrapTool(errTool).execute({}, ctxFor('e1'))
    acc.finalize()
    expect((acc.messages[0]!.content[0] as any).is_error).toBe(true)
  })
})
