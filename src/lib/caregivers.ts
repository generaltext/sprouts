// Caregivers are derived, not stored. Every entry carries the `actor` who logged
// it (from gt.user(), or a local fallback); the caregiver list is just the set of
// distinct actors across a child's log, plus the current user, each given a
// stable colour hashed from its id. No management UI, no extra file — adding a
// caregiver is simply that person opening the workspace and logging something.

import type { Actor } from './events'
import type { Caregiver, Entry } from './types'
import { ENTITY_COLORS } from './types'

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function colorForActor(id: string): string {
  return ENTITY_COLORS[hash(id) % ENTITY_COLORS.length]!
}

/** Distinct caregivers across a child's entries (+ the current user), by count. */
export function deriveCaregivers(entries: Entry[], me: Actor | null): Caregiver[] {
  const byId = new Map<string, Caregiver>()
  const ensure = (a: Actor) => {
    let c = byId.get(a.id)
    if (!c) {
      c = { id: a.id, name: a.name || 'Someone', color: colorForActor(a.id), count: 0 }
      byId.set(a.id, c)
    }
    // freshest non-empty name wins
    if (a.name && a.name !== c.name) c.name = a.name
    return c
  }
  if (me) ensure(me)
  for (const e of entries) {
    if (e.actor) ensure(e.actor).count++
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'
