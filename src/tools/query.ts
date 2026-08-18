import type { Tool } from '@agent-lite/core'
import { findParties, findAccountsByParty, findAccountDetail, findPartyDetail } from '../data/store'

export const queryParties: Tool = {
  name: 'query_parties',
  kind: 'query',
  description: '查询客户（参与方）。可按 KYC 状态、风险等级、类型(INDIVIDUAL/ORGANIZATION)、是否 PEP、姓名(模糊)筛选。返回客户概要列表。',
  inputSchema: {
    type: 'object',
    properties: {
      kyc_status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] },
      risk_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      party_type: { type: 'string', enum: ['INDIVIDUAL', 'ORGANIZATION'] },
      is_pep: { type: 'boolean' },
      name: { type: 'string', description: '姓名(对 display_name 做大小写不敏感子串匹配)' },
    },
  },
  responseSchema: { type: 'object', properties: { parties: { type: 'array', items: { type: 'object' } } } },
  async execute(input) {
    const f = input as { kyc_status?: any; risk_level?: any; party_type?: any; is_pep?: boolean; name?: string }
    return { data: { parties: findParties(f) } }
  },
}

export const queryAccounts: Tool = {
  name: 'query_accounts',
  kind: 'query',
  description: '按 party_id 查该客户持有的账户列表（含其在每个账户上的 role、余额、状态、币种）。',
  inputSchema: { type: 'object', properties: { party_id: { type: 'integer' } }, required: ['party_id'] },
  responseSchema: { type: 'object', properties: { accounts: { type: 'array', items: { type: 'object' } } } },
  async execute(input) {
    const { party_id } = input as { party_id: number }
    return { data: { accounts: findAccountsByParty(party_id) } }
  },
}

export const queryAccountDetails: Tool = {  name: 'query_account_details',
  kind: 'query',
  description: '按 account_id 查账户详情：账户字段 + 持有人列表(联名可见，含 role) + 关联卡列表(仅 last4)。',
  inputSchema: { type: 'object', properties: { account_id: { type: 'integer' } }, required: ['account_id'] },
  responseSchema: { type: 'object', properties: { account: { type: 'object' }, holders: { type: 'array' }, cards: { type: 'array' } } },
  async execute(input) {
    const { account_id } = input as { account_id: number }
    const detail = findAccountDetail(account_id)
    if (!detail) return { is_error: true, toLLM: [{ type: 'text', text: `account ${account_id} not found` }] }
    return { data: detail }
  },
}

export const queryPartyDetails: Tool = {
  name: 'query_party_details',
  kind: 'query',
  description: '按 party_id 查单个客户的完整详情：party 主档 + 个人(individual)/机构(organization)详情字段(姓名、国籍、职业 / 法定名称、注册号等) + 该客户持有的账户概要列表。查客户详情用这个；按条件筛客户列表用 query_parties。',
  inputSchema: { type: 'object', properties: { party_id: { type: 'integer' } }, required: ['party_id'] },
  responseSchema: { type: 'object', properties: { party: { type: 'object' }, accounts: { type: 'array' } } },
  async execute(input) {
    const { party_id } = input as { party_id: number }
    const detail = findPartyDetail(party_id)
    if (!detail) return { is_error: true, toLLM: [{ type: 'text', text: `party ${party_id} not found` }] }
    return { data: detail }
  },
}
