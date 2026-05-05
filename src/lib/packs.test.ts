import { describe, it, expect } from 'vitest'
import { PackType } from '@prisma/client'
import { groupPacksByType, PACK_TYPE_ORDER } from './packs'

function makePack(overrides: {
  type: PackType
  id?: string
  name?: string
  userPacks?: { userId: string }[]
}) {
  return {
    id: overrides.id ?? 'clxxxxxxxxxxxxxxxx',
    name: overrides.name ?? 'Test Pack',
    type: overrides.type,
    icon: null,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userPacks: overrides.userPacks ?? [],
  }
}

describe('groupPacksByType', () => {
  it('returns empty array for empty input', () => {
    expect(groupPacksByType([])).toEqual([])
  })

  it('returns groups in PACK_TYPE_ORDER', () => {
    const packs = [
      makePack({ type: PackType.KIT, id: 'kit1', name: 'A Kit' }),
      makePack({ type: PackType.EXPANSION, id: 'exp1', name: 'An EP' }),
      makePack({ type: PackType.GAME_PACK, id: 'gp1', name: 'A GP' }),
    ]
    const result = groupPacksByType(packs)
    const types = result.map(g => g.type)
    expect(types).toEqual([PackType.EXPANSION, PackType.GAME_PACK, PackType.KIT])
  })

  it('sets isOwned true when userPacks is non-empty', () => {
    const packs = [makePack({ type: PackType.EXPANSION, userPacks: [{ userId: 'user1' }] })]
    const result = groupPacksByType(packs)
    expect(result[0].packs[0].isOwned).toBe(true)
  })

  it('sets isOwned false when userPacks is empty', () => {
    const packs = [makePack({ type: PackType.EXPANSION, userPacks: [] })]
    const result = groupPacksByType(packs)
    expect(result[0].packs[0].isOwned).toBe(false)
  })

  it('omits groups that have no packs', () => {
    const packs = [makePack({ type: PackType.EXPANSION })]
    const result = groupPacksByType(packs)
    const types = result.map(g => g.type)
    expect(types).toEqual([PackType.EXPANSION])
    expect(types).not.toContain(PackType.GAME_PACK)
    expect(types).not.toContain(PackType.STUFF_PACK)
    expect(types).not.toContain(PackType.KIT)
  })

  it('strips userPacks, createdAt, updatedAt from output packs', () => {
    const packs = [makePack({ type: PackType.EXPANSION })]
    const result = groupPacksByType(packs)
    const pack = result[0].packs[0]
    expect(pack).toHaveProperty('id')
    expect(pack).toHaveProperty('name')
    expect(pack).toHaveProperty('type')
    expect(pack).toHaveProperty('icon')
    expect(pack).toHaveProperty('imageUrl')
    expect(pack).toHaveProperty('isOwned')
    expect(pack).not.toHaveProperty('userPacks')
    expect(pack).not.toHaveProperty('createdAt')
    expect(pack).not.toHaveProperty('updatedAt')
  })
})
