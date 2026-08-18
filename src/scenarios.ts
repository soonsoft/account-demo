export interface Scenario { name: string; query: string }
export const SCENARIOS: Scenario[] = [
  { name: 'list-pending-kyc', query: '列出所有 KYC 待审核的客户' },
  { name: 'alice-accounts', query: '查 Alice Chen 的账户和余额' },
  { name: 'high-risk-or-pep', query: '哪些客户是高风险或 PEP？' },
  { name: 'joint-account-detail', query: '显示账户 ACC-5002 的详情，包括持有人和卡' },
  { name: 'high-risk-totals', query: '列出所有高风险客户，并查他们各自的账户' },
]
