import { describe, it, expect } from 'vitest'
import { findParties, findAccountsByParty, findAccountDetail } from '../src/data/store'

describe('store', () => {
  it('findParties: no filter returns all with display_name', () => {
    const r = findParties({})
    expect(r).toHaveLength(6)
    expect(r[0]).toMatchObject({ party_id: 1001, display_name: 'Alice Chen', party_type: 'INDIVIDUAL' })
    expect(r.find(p => p.party_id === 2001)!.display_name).toBe('Acme Inc')
  })
  it('findParties: filter by kyc_status', () => {
    const r = findParties({ kyc_status: 'PENDING' })
    expect(r.map(p => p.party_id).sort()).toEqual([1002, 2002])
  })
  it('findParties: filter by risk_level', () => {
    expect(findParties({ risk_level: 'HIGH' }).map(p => p.party_id).sort()).toEqual([1003, 2002])
  })
  it('findParties: filter by is_pep', () => {
    expect(findParties({ is_pep: true }).map(p => p.party_id)).toEqual([1003])
  })
  it('findParties: filter by name (case-insensitive substring on display_name)', () => {
    expect(findParties({ name: 'alice' }).map(p => p.party_id)).toEqual([1001])
  })
  it('findParties: combined filter', () => {
    expect(findParties({ party_type: 'ORGANIZATION', risk_level: 'HIGH' }).map(p => p.party_id)).toEqual([2002])
  })
  it('findAccountsByParty: includes role; joint account appears for both holders', () => {
    const a1001 = findAccountsByParty(1001)
    expect(a1001.map(a => a.account_id).sort()).toEqual([5001, 5002])
    expect(a1001.find(a => a.account_id === 5002)!.role).toBe('PRIMARY_OWNER')
    const a1002 = findAccountsByParty(1002)
    expect(a1002.map(a => a.account_id)).toEqual([5002])
    expect(a1002[0]!.role).toBe('SECONDARY_OWNER')
  })
  it('findAccountDetail: account + holders (joint) + cards', () => {
    const d = findAccountDetail(5002)!
    expect(d.account.account_id).toBe(5002)
    expect(d.holders.map(h => h.party_id).sort()).toEqual([1001, 1002])
    expect(d.cards.map(c => c.last4)).toEqual(['1111'])
  })
  it('findAccountDetail: unknown account_id → null', () => {
    expect(findAccountDetail(9999)).toBeNull()
  })
})
