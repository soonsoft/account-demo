import { describe, it, expect } from 'vitest'
import { queryParties, queryAccounts, queryAccountDetails, queryPartyDetails } from '../src/tools/query'
import { buildTools } from '../src/tools/render'
import type { ToolContext } from '@agent-lite/core'

function ctx(): ToolContext {
  return { toolUseId: 't1', phase: 'query', signal: new AbortController().signal, resolve: () => undefined }
}

describe('query tools', () => {
  it('query_parties returns {data:{parties}}', async () => {
    const r = await queryParties.execute({ kyc_status: 'PENDING' }, ctx())
    expect(r.data).toMatchObject({ parties: expect.any(Array) })
    expect((r.data as any).parties.map((p: any) => p.party_id).sort()).toEqual([1002, 2002])
  })
  it('query_accounts returns {data:{accounts}} with role', async () => {
    const r = await queryAccounts.execute({ party_id: 1001 }, ctx())
    expect((r.data as any).accounts.map((a: any) => a.account_id).sort()).toEqual([5001, 5002])
  })
  it('query_account_details returns {data:{account,holders,cards}}', async () => {
    const r = await queryAccountDetails.execute({ account_id: 5002 }, ctx())
    const d = r.data as any
    expect(d.account.account_id).toBe(5002)
    expect(d.holders.length).toBe(2)
  })
  it('query_party_details merges party + individual/org detail + account summaries', async () => {
    const r = await queryPartyDetails.execute({ party_id: 1001 }, ctx())
    const d = r.data as any
    expect(d.party.party_id).toBe(1001)
    expect(d.party.display_name).toBe('Alice Chen')       // individual 详情并进来了
    expect(d.party.nationality).toBe('CN')
    expect(d.party.occupation).toBe('Software Engineer')
    expect(d.accounts.map((a: any) => a.account_id).sort()).toEqual([5001, 5002])  // 账户概要
  })
  it('query_party_details: org party gets legal_name etc.', async () => {
    const r = await queryPartyDetails.execute({ party_id: 2001 }, ctx())
    const d = r.data as any
    expect(d.party.display_name).toBe('Acme Inc')
    expect(d.party.registration_number).toBe('REG001')
  })
  it('query_party_details: unknown party_id → is_error', async () => {
    const r = await queryPartyDetails.execute({ party_id: 9999 }, ctx())
    expect(r.is_error).toBe(true)
  })
})

describe('render_table + buildTools', () => {
  it('buildTools returns query_* + render_table + render_detail + finalize_data', () => {
    const tools = buildTools()
    const names = tools.map(t => t.name).sort()
    expect(names).toEqual(['finalize_data', 'query_account_details', 'query_accounts', 'query_parties', 'query_party_details', 'render_detail', 'render_table'])
  })
  it('render_table resolves refs via ctx.resolve, calls ctx.present with HTML table', async () => {
    const tools = buildTools()
    const renderTable = tools.find(t => t.name === 'render_table')!
    const rows = [{ name: 'Alice', account: { accountType: 'CHECKING' } }]
    let presented = ''
    const ctx: any = {
      toolUseId: 't3', phase: 'render', signal: new AbortController().signal,
      resolve: (ref: string) => (ref === 't1.accounts' ? rows : undefined),
      present: (html: string) => { presented = html },
    }
    const r = await renderTable.execute({ from: ['t1.accounts'], columns: [{ path: 'name', title: '姓名' }, { path: 'account.accountType', title: '类型' }] }, ctx)
    expect(presented).toContain('<table>')
    expect(presented).toContain('Alice')
    expect(presented).toContain('CHECKING')
    expect(r.toLLM?.[0]).toMatchObject({ type: 'text' })
  })
})

describe('render_detail defensive checks + buildTools', () => {
  it('render_detail: from resolves to an ARRAY → is_error (list data must use render_table)', async () => {
    const tools = buildTools()
    const renderDetail = tools.find(t => t.name === 'render_detail')!
    let presented = ''
    const ctx: any = {
      toolUseId: 't3', phase: 'render', signal: new AbortController().signal,
      resolve: () => [{ a: 1 }, { a: 2 }],               // 数组（列表数据）
      present: (html: string) => { presented = html },
    }
    const r = await renderDetail.execute({ from: ['query_parties.parties'], fields: [{ path: 'a', label: 'A' }] }, ctx)
    expect(r.is_error).toBe(true)
    expect(presented).toBe('')                             // 不渲染空表单
    expect(JSON.stringify(r.toLLM)).toContain('render_table')
  })
  it('render_detail resolves a single-object ref, calls ctx.present with <dl> form HTML', async () => {
    const tools = buildTools()
    const renderDetail = tools.find(t => t.name === 'render_detail')!
    const account = { account_id: 5002, account_type: 'SAVINGS', currency_code: 'USD', current_balance: 50000, holders: [{ party_id: 1001 }, { party_id: 1002 }] }
    let presented = ''
    const ctx: any = {
      toolUseId: 't3', phase: 'render', signal: new AbortController().signal,
      resolve: (ref: string) => (ref === 'query_account_details.account' ? account : undefined),
      present: (html: string) => { presented = html },
    }
    const r = await renderDetail.execute({
      from: ['query_account_details.account'],
      fields: [
        { path: 'account_id', label: '账户ID' },
        { path: 'account_type', label: '类型' },
        { path: 'currency_code', label: '币种' },
        { path: 'current_balance', label: '当前余额' },
        { path: 'holders', label: '持有人' },
        { path: 'closed_at', label: '销户时间' },
      ],
      title: '账户 5002 详情',
    }, ctx)
    expect(presented).toContain('<dl>')                       // 表单形态
    expect(presented).toContain('账户ID')                     // label 渲染
    expect(presented).toContain('SAVINGS')                    // 标量值
    expect(presented).toContain('detail-json')                // 嵌套数组 → 紧凑 JSON
    expect(presented).toContain('detail-null')                // 缺失字段 → —
    expect(presented).not.toContain('<table>')                // 不是表格
    expect(r.toLLM?.[0]).toMatchObject({ type: 'text' })
  })
})
