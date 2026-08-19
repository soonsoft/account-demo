import type { Tool } from '@agent-lite/core'
import { FINALIZE_DATA } from '@agent-lite/core'
import { RendererRegistry, renderTable, renderDetail } from '@agent-lite/core/adapter'
import { queryParties, queryAccounts, queryAccountDetails, queryPartyDetails } from './query'

// 模块级 registry（browser-portable；渲染器是纯函数）
const registry = new RendererRegistry()
registry.register('render_table', renderTable)
registry.register('render_detail', renderDetail)

export const renderTableTool: Tool = {
  name: 'render_table',
  kind: 'render',
  description: '把先前查询结果渲染成 HTML 表。from 引用查询结果数组(如 ["t1.accounts"])；columns 选择每行字段(path 支持点/下标，title 为表头)。',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'array', items: { type: 'string' }, description: '引用数组，如 ["t1.accounts"] 或复数 ["query_party_details[].party"]' },
      columns: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, title: { type: 'string' } }, required: ['path'] } },
      orderBy: { type: 'string', description: '排序字段 path（缺值沉底；数值按数值比）。如 opened_at' },
      order: { type: 'string', enum: ['asc', 'desc'], description: '排序方向，默认 asc' },
      limit: { type: 'integer', description: '只保留前 N 行（配合 orderBy 用，如最早/最新/前几条）' },
      title: { type: 'string', description: '表标题(caption)' },
    },
    required: ['from', 'columns'],
  },
  responseSchema: { type: 'object', properties: { rendered: { type: 'number' } } },
  async execute(input, ctx) {
    const { from, columns, title } = input as { from: string[]; columns: { path: string; title?: string }[]; title?: string }
    // 多 id 合并：每个 ref 解析为一个行源(数组)，按序拼接
    const rows = from.flatMap(ref => {
      const v = ctx.resolve(ref)
      return Array.isArray(v) ? v : (v == null ? [] : [v])
    })
    const html = registry.render('render_table', rows, { columns, title })
    ctx.present?.(html)
    return { toLLM: [{ type: 'text', text: `rendered ${rows.length} rows` }] }
  },
}

export const renderDetailTool: Tool = {
  name: 'render_detail',
  kind: 'render',
  description: '把先前查到的**单个对象**渲染成详情表单（两列：字段名/值）。from 引用一个对象（如 ["query_account_details.account"]）；fields 选字段（path 支持点/下标，label 为字段显示名）。列表数据请用 render_table。',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'array', items: { type: 'string' }, description: '引用单个对象，如 ["query_account_details.account"]' },
      fields: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, label: { type: 'string' } }, required: ['path'] } },
      title: { type: 'string', description: '表单标题' },
    },
    required: ['from', 'fields'],
  },
  responseSchema: { type: 'object', properties: { rendered: { type: 'number' } } },
  async execute(input, ctx) {
    const { from, fields, title } = input as { from: string[]; fields: { path: string; label?: string }[]; title?: string }
    // 多个 ref 时取第一个非空（detail 是单对象语义；后续 ref 视为冗余忽略）
    let obj: unknown
    for (const ref of from) {
      const v = ctx.resolve(ref)
      if (v != null) { obj = v; break }
    }
    if (obj == null) return { is_error: true, toLLM: [{ type: 'text', text: `from 引用解析为空：${from.join(', ')}` }] }
    // 防御：列表数据误用 detail → 显式报错引导改用 render_table，而不是渲染一堆空字段
    if (Array.isArray(obj)) return { is_error: true, toLLM: [{ type: 'text', text: `from 解析到数组（列表数据）——render_detail 只渲染单个对象；请改用 render_table` }] }
    const html = registry.render('render_detail', obj, { fields, title })
    ctx.present?.(html)
    return { toLLM: [{ type: 'text', text: 'rendered detail' }] }
  },
}

/** 组装全部工具（query + render + control）。agent core 与测试共用。 */
export function buildTools(): Tool[] {
  return [queryParties, queryAccounts, queryAccountDetails, queryPartyDetails, renderTableTool, renderDetailTool, FINALIZE_DATA]
}
