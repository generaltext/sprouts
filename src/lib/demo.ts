// Synthetic demo data for the public "Try it live" session and the standalone
// "Try the demo" button. A fictional baby ("Willow") with a few weeks of
// plausible, calm-looking logs — enough to show the dashboard, timeline, week
// summary, growth, and a poster preview. NEVER real data. Deterministic (seeded
// RNG) so the demo looks the same every time.

import { serializeEvent, type Actor, type SproutsEvent } from './events'
import { newId } from './ids'
import type { SeedData } from './seed'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CAREGIVERS: Actor[] = [
  { id: 'demo-parent-a', name: 'Alex' },
  { id: 'demo-parent-b', name: 'Sam' },
]

const DAYS = 21

export function demoSeed(): SeedData {
  const rand = mulberry32(20260713)
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!
  const jitter = (mins: number) => (rand() - 0.5) * mins * 60_000

  const now = new Date()
  const childId = 'chi_DEMO_WILLOW'
  const birth = new Date(now.getTime() - 70 * 86_400_000)
  const birthDate = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`

  const children: SproutsEvent[] = [
    {
      id: newId('evt'),
      ts: birth.toISOString(),
      actor: CAREGIVERS[0]!,
      type: 'child.create',
      subject: childId,
      data: { name: 'Willow', birthDate, sex: 'f', color: '#3f9d52' },
    },
  ]

  const log: SproutsEvent[] = []
  const at = (dayStart: Date, hour: number, min = 0) =>
    new Date(dayStart.getTime() + hour * 3_600_000 + min * 60_000 + jitter(20))
  const push = (start: Date, data: Record<string, unknown>, actor = pick(CAREGIVERS)) =>
    log.push({ id: newId('evt'), ts: start.toISOString(), actor, type: 'entry.log', subject: newId('ent'), data: { start: start.toISOString(), ...data } })

  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)

    // Night sleep (previous evening → morning), then naps.
    const nightStart = at(day, 19, 30)
    const nightEnd = new Date(nightStart.getTime() + (5 + rand() * 3) * 3_600_000)
    push(nightStart, { kind: 'sleep', end: nightEnd.toISOString() })
    const napHours = [9, 12, 15, 17]
    for (const h of napHours) {
      if (rand() < 0.2) continue
      const s = at(day, h)
      const e = new Date(s.getTime() + (0.5 + rand() * 1.3) * 3_600_000)
      push(s, { kind: 'sleep', end: e.toISOString() })
    }

    // Feeds through the day (mix bottle + nursing).
    for (const h of [6, 9, 12, 15, 18, 21, 0]) {
      const s = at(day, h)
      if (rand() < 0.5) {
        push(s, { kind: 'feed.bottle', volumeMl: 90 + Math.round(rand() * 60), contents: pick(['breastmilk', 'formula', 'mixed']) })
      } else {
        const left = Math.round(rand() * 600)
        const right = Math.round(rand() * 600)
        push(s, { kind: 'feed.breast', end: new Date(s.getTime() + (left + right) * 1000).toISOString(), leftSec: left, rightSec: right, lastSide: pick(['left', 'right']) })
      }
    }

    // Diapers.
    for (const h of [6, 8, 11, 14, 17, 20]) {
      if (rand() < 0.15) continue
      const dirty = rand() < 0.4
      push(at(day, h), { kind: 'diaper', wet: rand() < 0.85, dirty, ...(dirty && rand() < 0.3 ? { blowout: true } : {}) })
    }

    // The odd tummy-time and note.
    if (rand() < 0.6) {
      const s = at(day, 10)
      push(s, { kind: 'tummy', end: new Date(s.getTime() + (5 + rand() * 15) * 60_000).toISOString(), label: 'Tummy time' })
    }
    if (rand() < 0.15) push(at(day, 16), { kind: 'note', note: pick(['So many smiles today.', 'Rolled halfway over!', 'Loves the ceiling fan.', 'Fussy afternoon, better after a walk.']) })
  }

  // A couple of growth points + a milestone.
  push(new Date(birth.getTime() + 14 * 86_400_000), { kind: 'growth', weightG: 3800, heightCm: 53, headCm: 37 })
  push(new Date(birth.getTime() + 42 * 86_400_000), { kind: 'growth', weightG: 4900, heightCm: 57, headCm: 39 })
  push(new Date(now.getTime() - 3 * 86_400_000), { kind: 'growth', weightG: 5600, heightCm: 59.5, headCm: 40.5 })
  push(new Date(now.getTime() - 7 * 86_400_000), { kind: 'milestone', label: 'First real giggle' })

  return { children, logs: { [childId]: log } }
}

/** Convenience: seed as ready-to-write file contents. */
export function seedToFiles(seed: SeedData): { children: string; logs: Record<string, string> } {
  return {
    children: seed.children.map(serializeEvent).join('\n') + '\n',
    logs: Object.fromEntries(Object.entries(seed.logs).map(([id, evs]) => [id, evs.map(serializeEvent).join('\n') + '\n'])),
  }
}
