import { describe, expect, it } from 'vitest'
import type { SproutsEvent } from './events'
import { foldChildren, foldEntries } from './reducer'

let n = 0
function ev(type: string, subject: string, data?: Record<string, unknown>, ts?: string): SproutsEvent {
  return { id: `evt_${String(++n).padStart(4, '0')}`, ts: ts ?? `2026-01-01T00:00:${String(n).padStart(2, '0')}.000Z`, actor: { id: 'u1', name: 'Pat' }, type, subject, ...(data ? { data } : {}) }
}

describe('foldChildren', () => {
  it('creates, updates, and archives', () => {
    const s = foldChildren([
      ev('child.create', 'c1', { name: 'Arthur', birthDate: '2023-04-01', sex: 'm', color: '#111' }),
      ev('child.update', 'c1', { name: 'Artie' }),
      ev('child.create', 'c2', { name: 'Willow', sex: 'f' }),
      ev('child.archive', 'c2', { archived: true }),
    ])
    expect(s.order).toEqual(['c1', 'c2'])
    expect(s.byId.c1!.name).toBe('Artie')
    expect(s.byId.c1!.birthDate).toBe('2023-04-01')
    expect(s.byId.c2!.archived).toBe(true)
    expect(s.byId.c2!.sex).toBe('f')
  })

  it('ignores updates to unknown children and unknown sex values', () => {
    const s = foldChildren([ev('child.update', 'ghost', { name: 'X' }), ev('child.create', 'c1', { sex: 'weird' })])
    expect(s.byId.ghost).toBeUndefined()
    expect(s.byId.c1!.sex).toBe('u')
  })
})

describe('foldEntries', () => {
  it('upserts an entry on repeated entry.log (last-writer-wins)', () => {
    const list = foldEntries([
      ev('entry.log', 'e1', { kind: 'feed.bottle', start: '2026-01-01T08:00:00.000Z', volumeMl: 120, contents: 'formula' }),
      ev('entry.log', 'e1', { kind: 'feed.bottle', start: '2026-01-01T08:00:00.000Z', volumeMl: 150, contents: 'breastmilk' }),
    ])
    expect(list).toHaveLength(1)
    expect(list[0]!.volumeMl).toBe(150)
    expect(list[0]!.contents).toBe('breastmilk')
  })

  it('removes an entry', () => {
    const list = foldEntries([
      ev('entry.log', 'e1', { kind: 'diaper', start: '2026-01-01T08:00:00.000Z', wet: true }),
      ev('entry.log', 'e2', { kind: 'diaper', start: '2026-01-01T09:00:00.000Z', dirty: true }),
      ev('entry.remove', 'e1'),
    ])
    expect(list.map((e) => e.id)).toEqual(['e2'])
  })

  it('sorts by start time regardless of arrival order', () => {
    const list = foldEntries([
      ev('entry.log', 'e2', { kind: 'sleep', start: '2026-01-01T12:00:00.000Z', end: '2026-01-01T13:00:00.000Z' }),
      ev('entry.log', 'e1', { kind: 'sleep', start: '2026-01-01T06:00:00.000Z', end: null }),
    ])
    expect(list.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(list[0]!.end).toBeNull() // running timer preserved as null
    expect(list[1]!.end).toBe('2026-01-01T13:00:00.000Z')
  })

  it('drops entries with an unknown kind', () => {
    const list = foldEntries([ev('entry.log', 'e1', { kind: 'teleport', start: '2026-01-01T08:00:00.000Z' })])
    expect(list).toHaveLength(0)
  })

  it('carries breastfeed side + durations through an edit', () => {
    const list = foldEntries([
      ev('entry.log', 'e1', { kind: 'feed.breast', start: '2026-01-01T08:00:00.000Z', leftSec: 300, rightSec: 200, lastSide: 'right' }),
      ev('entry.log', 'e1', { kind: 'feed.breast', start: '2026-01-01T08:00:00.000Z', note: 'sleepy' }),
    ])
    expect(list[0]!.leftSec).toBe(300)
    expect(list[0]!.lastSide).toBe('right')
    expect(list[0]!.note).toBe('sleepy')
  })
})
