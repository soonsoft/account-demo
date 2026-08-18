import type { AgentEvent, LLMClient, Message, Tool } from '@agent-lite/core'
import { runAgent } from '@agent-lite/core'
import { ProxyLLMClient } from '@agent-lite/core/proxy-client'
import { buildTools } from './tools/render'
import { MessageAccumulator } from './message-accumulator'
import { SYSTEM_PROMPT } from './prompt'

const DEFAULT_GATEWAY = 'http://127.0.0.1:3000/llm'

export interface RunSessionOpts {
  messages: Message[]
  onEvent: (e: AgentEvent) => void
  signal?: AbortSignal
  maxTurns?: number
  gatewayUrl?: string
}

/** 内部 seam：注入 llm + tools，便于用 ScriptedLLMClient 做确定性集成测试。tools 缺省 = buildTools()。 */
export async function runSessionWithLlm(
  opts: { messages: Message[]; onEvent: (e: AgentEvent) => void; signal?: AbortSignal; maxTurns?: number; llm: LLMClient; tools?: Tool[] },
): Promise<{ messages: Message[] }> {
  const acc = new MessageAccumulator(opts.messages)
  const wrappedLlm = acc.wrapLlm(opts.llm)
  const wrappedTools = (opts.tools ?? buildTools()).map(t => acc.wrapTool(t))
  for await (const e of runAgent({
    messages: opts.messages,
    systemPrompt: SYSTEM_PROMPT,
    tools: wrappedTools,
    llm: wrappedLlm,
    model: 'glm-5.2',
    signal: opts.signal,
    maxTurns: opts.maxTurns,
  })) {
    opts.onEvent(e)
  }
  acc.finalize()
  return { messages: acc.messages }
}

/** 公开入口：构造 ProxyLLMClient + tools，跑 runSessionWithLlm。browser-portable（不读 process.env）。 */
export async function runSession(opts: RunSessionOpts): Promise<{ messages: Message[] }> {
  const llm = new ProxyLLMClient(opts.gatewayUrl ?? DEFAULT_GATEWAY)
  return runSessionWithLlm({
    messages: opts.messages, onEvent: opts.onEvent, signal: opts.signal, maxTurns: opts.maxTurns,
    llm, tools: buildTools(),
  })
}
