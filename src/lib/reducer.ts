// The projections: fold each event log into current-state records. Application
// is idempotent (each event id applied at most once) and always processed in
// deterministic (ts, id) order, so last-writer-wins is stable regardless of the
// order lines happened to land in the file. Three concerns, three folds, one
// shared envelope — children and caregivers live in their own files, and each
// child's entries in that child's own log.

import type { Actor, SproutsEvent } from './events'
import type { BottleContents, Child, Entry, EntryKind, Side } from './types'

function sorted(events: SproutsEvent[]): SproutsEvent[] {
  return [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1))
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const numOrU = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const boolOrU = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

// ── children ──────────────────────────────────────────────────────────────────

export interface ChildrenState {
  byId: Record<string, Child>
  /** child ids in creation order */
  order: string[]
}

export function foldChildren(events: SproutsEvent[]): ChildrenState {
  const state: ChildrenState = { byId: {}, order: [] }
  const applied = new Set<string>()
  for (const ev of sorted(events)) {
    if (applied.has(ev.id)) continue
    applied.add(ev.id)
    const [entity, verb] = ev.type.split('.')
    if (entity !== 'child') continue
    const id = ev.subject
    const d = ev.data ?? {}
    if (verb === 'create') {
      if (state.byId[id]) continue
      state.byId[id] = {
        id,
        name: str(d.name) || 'Baby',
        birthDate: str(d.birthDate),
        sex: (['m', 'f', 'u'].includes(str(d.sex)) ? str(d.sex) : 'u') as Child['sex'],
        color: str(d.color) || '#3f9d52',
        archived: false,
        createdAt: ev.ts,
      }
      state.order.push(id)
    } else {
      const rec = state.byId[id]
      if (!rec) continue
      if (verb === 'update') {
        if (typeof d.name === 'string' && d.name.trim()) rec.name = d.name.trim()
        if (typeof d.birthDate === 'string') rec.birthDate = d.birthDate
        if (d.sex === 'm' || d.sex === 'f' || d.sex === 'u') rec.sex = d.sex
        if (typeof d.color === 'string') rec.color = d.color
      } else if (verb === 'archive') {
        rec.archived = d.archived === false ? false : true
      }
    }
  }
  return state
}

// ── entries (one child's activity log) ────────────────────────────────────────

const KINDS = new Set<EntryKind>([
  'sleep',
  'feed.bottle',
  'feed.breast',
  'feed.pump',
  'feed.solid',
  'diaper',
  'growth',
  'tummy',
  'medicine',
  'milestone',
  'note',
])

/** Build one folded Entry from an `entry.log` payload (merging over a prior). */
function toEntry(id: string, ev: SproutsEvent, prev: Entry | undefined): Entry | null {
  const d = ev.data ?? {}
  const kind = str(d.kind) as EntryKind
  if (!KINDS.has(kind)) return null
  const prevRec = prev as unknown as Record<string, unknown> | undefined
  const out: Record<string, unknown> = {
    id,
    kind,
    start: str(d.start) || prev?.start || ev.ts,
    actor: (ev.actor as Actor | null) ?? prev?.actor ?? null,
    updatedAt: ev.ts,
  }
  // `end` is tri-state: a string (ended), null (running), or absent (point event).
  if ('end' in d) out.end = typeof d.end === 'string' ? d.end : null
  else if (prevRec && 'end' in prevRec) out.end = prevRec.end

  const copyStr = (k: string) => {
    const v = d[k]
    if (typeof v === 'string') out[k] = v
    else if (prevRec && prevRec[k] !== undefined) out[k] = prevRec[k]
  }
  const copyNum = (k: string) => {
    const v = numOrU(d[k])
    if (v !== undefined) out[k] = v
    else if (prevRec && prevRec[k] !== undefined) out[k] = prevRec[k]
  }
  const copyBool = (k: string) => {
    const v = boolOrU(d[k])
    if (v !== undefined) out[k] = v
    else if (prevRec && prevRec[k] !== undefined) out[k] = prevRec[k]
  }

  copyStr('note')
  copyNum('volumeMl')
  if (['breastmilk', 'formula', 'mixed'].includes(str(d.contents))) out.contents = str(d.contents) as BottleContents
  else if (prev?.contents) out.contents = prev.contents
  copyNum('leftSec')
  copyNum('rightSec')
  if (d.lastSide === 'left' || d.lastSide === 'right') out.lastSide = d.lastSide as Side
  else if (prev?.lastSide) out.lastSide = prev.lastSide
  copyNum('leftMl')
  copyNum('rightMl')
  copyStr('food')
  copyBool('wet')
  copyBool('dirty')
  copyStr('stoolColor')
  copyBool('blowout')
  copyNum('weightG')
  copyNum('heightCm')
  copyNum('headCm')
  copyStr('label')
  copyStr('medName')
  copyStr('dose')
  return out as unknown as Entry
}

/** Fold one child's log into a start-sorted list of entries. */
export function foldEntries(events: SproutsEvent[]): Entry[] {
  const byId: Record<string, Entry> = {}
  const applied = new Set<string>()
  for (const ev of sorted(events)) {
    if (applied.has(ev.id)) continue
    applied.add(ev.id)
    const [entity, verb] = ev.type.split('.')
    if (entity !== 'entry') continue
    const id = ev.subject
    if (verb === 'log') {
      const next = toEntry(id, ev, byId[id])
      if (next) byId[id] = next
    } else if (verb === 'remove') {
      delete byId[id]
    }
  }
  return Object.values(byId).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1))
}
