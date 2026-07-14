// Prepare a child's log for the poster: one entry per calendar day across the
// whole span (empty days included, so the vertical/temporal axis is continuous),
// with sleep as fractional time-of-day segments (split across midnight) and
// point events (feeds, diapers) as fractional times. Times are local wall-clock,
// which is what makes the emergent day/night rhythm legible.

import { dayKeyOf } from './dates'
import { isFeed } from './summary'
import type { Entry } from './types'

const DAY_MS = 86_400_000

export interface PosterDay {
  key: string
  date: Date
  /** sleep segments as [start,end] fractions of the day, 0 = midnight, 1 = next midnight */
  sleep: { s: number; e: number }[]
  /** feed times as fractions of the day */
  feeds: number[]
  /** diaper times as fractions of the day */
  diapers: number[]
}

export interface PosterData {
  days: PosterDay[]
  first: Date
  last: Date
  dayCount: number
}

/** Split a [startMs,endMs] interval into per-local-day fractional segments. */
function splitSleep(startMs: number, endMs: number): { key: string; s: number; e: number }[] {
  const out: { key: string; s: number; e: number }[] = []
  let cur = startMs
  let guard = 0
  while (cur < endMs && guard++ < 400) {
    const d = new Date(cur)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const nextDay = dayStart + DAY_MS
    const segEnd = Math.min(endMs, nextDay)
    out.push({ key: dayKeyOf(new Date(dayStart)), s: (cur - dayStart) / DAY_MS, e: (segEnd - dayStart) / DAY_MS })
    cur = segEnd
  }
  return out
}

function fractionOfDay(ms: number): number {
  const d = new Date(ms)
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return (ms - dayStart) / DAY_MS
}

export function buildPosterData(entries: Entry[], birthDate?: string): PosterData | null {
  if (entries.length === 0) return null

  const byKey = new Map<string, PosterDay>()
  const ensure = (date: Date): PosterDay => {
    const key = dayKeyOf(date)
    let d = byKey.get(key)
    if (!d) {
      d = { key, date: new Date(date.getFullYear(), date.getMonth(), date.getDate()), sleep: [], feeds: [], diapers: [] }
      byKey.set(key, d)
    }
    return d
  }

  for (const e of entries) {
    if (e.kind === 'sleep' && e.end) {
      for (const seg of splitSleep(new Date(e.start).getTime(), new Date(e.end).getTime())) {
        const [y, m, dd] = seg.key.split('-').map(Number)
        ensure(new Date(y!, m! - 1, dd!)).sleep.push({ s: seg.s, e: seg.e })
      }
    } else if (isFeed(e.kind)) {
      ensure(new Date(e.start)).feeds.push(fractionOfDay(new Date(e.start).getTime()))
    } else if (e.kind === 'diaper') {
      ensure(new Date(e.start)).diapers.push(fractionOfDay(new Date(e.start).getTime()))
    }
  }

  // Continuous calendar range: from birth (if known and earlier) or first logged
  // day, through the last logged day.
  const keys = [...byKey.keys()].sort()
  const firstLogged = keys[0]!
  const lastLogged = keys[keys.length - 1]!
  const [fy, fm, fd] = firstLogged.split('-').map(Number)
  let first = new Date(fy!, fm! - 1, fd!)
  if (birthDate) {
    const [by, bm, bd] = birthDate.split('-').map(Number)
    if (by && bm && bd) {
      const birth = new Date(by, bm - 1, bd)
      if (birth < first) first = birth
    }
  }
  const [ly, lm, ld] = lastLogged.split('-').map(Number)
  const last = new Date(ly!, lm! - 1, ld!)

  const days: PosterDay[] = []
  const cursor = new Date(first)
  let guard = 0
  while (cursor <= last && guard++ < 20_000) {
    days.push(ensure(new Date(cursor)))
    cursor.setDate(cursor.getDate() + 1)
  }

  return { days, first, last, dayCount: days.length }
}
