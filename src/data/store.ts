import fixture from './fixture.json'

type PartyType = 'INDIVIDUAL' | 'ORGANIZATION'
type Kyc = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
type Risk = 'LOW' | 'MEDIUM' | 'HIGH'

interface PartyRow { party_id: number; party_type: PartyType; kyc_status: Kyc; risk_level: Risk; is_pep: boolean; created_at: string; updated_at: string }
interface IndividualRow { party_id: number; first_name: string; last_name: string; nationality: string; occupation: string }
interface OrgRow { party_id: number; legal_name: string; business_name: string; registration_number: string; tax_id: string; date_of_incorporation: string; registered_capital: number; legal_representative: string }
interface AccountRow { account_id: number; account_number: string; account_type: string; currency_code: string; status: string; current_balance: number; available_balance: number; opened_at: string }
interface RelationRow { relation_id: number; account_id: number; party_id: number; role: string; permissions: Record<string, boolean> }
interface CardRow { card_id: number; account_id: number; last4: string; card_holder_name: string; card_type: string; brand: string; status: string }

const db = fixture as {
  parties: PartyRow[]; individuals: IndividualRow[]; organizations: OrgRow[]
  accounts: AccountRow[]; account_holder_relations: RelationRow[]; bank_cards: CardRow[]
}

function displayName(p: PartyRow): string {
  if (p.party_type === 'INDIVIDUAL') {
    const i = db.individuals.find(x => x.party_id === p.party_id)!
    return `${i.first_name} ${i.last_name}`
  }
  return db.organizations.find(x => x.party_id === p.party_id)!.legal_name
}

export interface PartySummary { party_id: number; party_type: PartyType; display_name: string; kyc_status: Kyc; risk_level: Risk; is_pep: boolean }

export function findParties(filter: { kyc_status?: Kyc; risk_level?: Risk; party_type?: PartyType; is_pep?: boolean; name?: string }): PartySummary[] {
  return db.parties
    .filter(p => filter.kyc_status === undefined || p.kyc_status === filter.kyc_status)
    .filter(p => filter.risk_level === undefined || p.risk_level === filter.risk_level)
    .filter(p => filter.party_type === undefined || p.party_type === filter.party_type)
    .filter(p => filter.is_pep === undefined || p.is_pep === filter.is_pep)
    .filter(p => filter.name === undefined || displayName(p).toLowerCase().includes(filter.name.toLowerCase()))
    .map(p => ({ party_id: p.party_id, party_type: p.party_type, display_name: displayName(p), kyc_status: p.kyc_status, risk_level: p.risk_level, is_pep: p.is_pep }))
}

export interface PartyDetail { party: Record<string, unknown> & { party_id: number; display_name: string }; accounts: AccountSummary[] }

/** 单个客户完整详情：party 主档 + individual/organization 详情字段（平铺合并）+ 其账户概要。 */
export function findPartyDetail(partyId: number): PartyDetail | null {
  const p = db.parties.find(x => x.party_id === partyId)
  if (!p) return null
  const extra = p.party_type === 'INDIVIDUAL'
    ? db.individuals.find(x => x.party_id === partyId)
    : db.organizations.find(x => x.party_id === partyId)
  return {
    party: { party_type: p.party_type, kyc_status: p.kyc_status, risk_level: p.risk_level, is_pep: p.is_pep, created_at: p.created_at, updated_at: p.updated_at, ...(extra ?? {}), party_id: p.party_id, display_name: displayName(p) },
    accounts: findAccountsByParty(partyId),
  }
}

export interface AccountSummary { account_id: number; account_number: string; account_type: string; currency_code: string; status: string; current_balance: number; available_balance: number; role: string }

export function findAccountsByParty(partyId: number): AccountSummary[] {
  return db.account_holder_relations
    .filter(r => r.party_id === partyId)
    .map(r => {
      const a = db.accounts.find(x => x.account_id === r.account_id)!
      return { account_id: a.account_id, account_number: a.account_number, account_type: a.account_type, currency_code: a.currency_code, status: a.status, current_balance: a.current_balance, available_balance: a.available_balance, role: r.role }
    })
}

export interface AccountDetail { account: AccountRow; holders: { party_id: number; display_name: string; role: string }[]; cards: { card_id: number; card_type: string; brand: string; last4: string; status: string }[] }

export function findAccountDetail(accountId: number): AccountDetail | null {
  const account = db.accounts.find(a => a.account_id === accountId)
  if (!account) return null
  const holders = db.account_holder_relations
    .filter(r => r.account_id === accountId)
    .map(r => {
      const p = db.parties.find(x => x.party_id === r.party_id)!
      return { party_id: r.party_id, display_name: displayName(p), role: r.role }
    })
  const cards = db.bank_cards
    .filter(c => c.account_id === accountId)
    .map(c => ({ card_id: c.card_id, card_type: c.card_type, brand: c.brand, last4: c.last4, status: c.status }))
  return { account, holders, cards }
}
