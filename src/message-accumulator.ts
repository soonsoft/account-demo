import type { ContentBlock, LLMClient, LLMRequest, LLMResponse, Message, Tool, ToolContext, ToolResult } from '@agent-lite/core'

/** 包装 llm.chat + tool.execute，按轮累积完整 messages[]，供多轮续接。browser-portable（无 Node API）。 */
export class MessageAccumulator {
  readonly messages: Message[]
  private pending: ContentBlock[] = []

  constructor(initial: Message[]) { this.messages = [...initial] }

  /** 包装 LLM：捕获每次成功响应为 assistant 消息；下一次 chat 前先 flush 上一轮的 tool_results。 */
  wrapLlm(llm: LLMClient): LLMClient {
    const chat = async (req: LLMRequest): Promise<LLMResponse> => {
      this.flush()
      const res = await llm.chat(req)
      this.messages.push({ role: 'assistant', content: res.content })
      return res
    }
    return { chat }
  }

  /** 包装 tool：执行后把 tool_result 块缓冲进 pending（复刻 ToolExecutor 默认 toLLM）。 */
  wrapTool(tool: Tool): Tool {
    return {
      ...tool,
      execute: async (input, ctx: ToolContext) => {
        const result: ToolResult = await tool.execute(input, ctx)
        // 复刻 ToolExecutor 默认 toLLM；demo 数据很小，不做 maxToolResultChars 截断（见 spec §6）
        const toLLM: ContentBlock[] = result.toLLM
          ?? (result.data !== undefined ? [{ type: 'text', text: JSON.stringify(result.data) }] : [])
        const block: ContentBlock = {
          type: 'tool_result',
          tool_use_id: ctx.toolUseId,
          content: toLLM,
          ...(result.is_error === true ? { is_error: true } : {}),
        }
        this.pending.push(block)
        return result
      },
    }
  }

  /** 把缓冲的 tool_results 作为单条 user 消息 flush。 */
  flush(): void {
    if (this.pending.length) {
      this.messages.push({ role: 'user', content: this.pending })
      this.pending = []
    }
  }

  /** run 结束时调用：覆盖 max_turns/abort 退出路径——先补齐悬空 tool_use，再 flush。 */
  finalize(): void {
    // abort 窗口：assistant 消息已 push、但其 tool_use 没全部执行完 → 留下无配对 tool_result 的
    // tool_use，部分 provider 下轮会拒。为每个悬空 tool_use 合成 is_error 的 tool_result。
    // 配对检查要覆盖已 flush 的历史 + 尚在 pending 的全部 tool_result（否则已配对的会被补重）。
    const unpaired = new Set(
      this.messages.flatMap(m => m.content)
        .filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
        .map(b => b.id),
    )
    for (const b of [...this.messages.flatMap(m => m.content), ...this.pending]) {
      if (b.type === 'tool_result') unpaired.delete(b.tool_use_id)
    }
    for (const id of unpaired) {
      this.pending.push({ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: 'aborted: tool_use did not complete before the run ended' }], is_error: true })
    }
    this.flush()
  }
}
