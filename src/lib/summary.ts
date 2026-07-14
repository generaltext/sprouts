// Descriptive selectors over a child's entries. Read-only aggregates — totals,
// counts, longest stretch — never predictions. Sleep is attributed to the local
// day it *started* (how parents think of "last night's sleep"); the poster splits
// sleep across midnight for accurate placement, which is a separate concern.

import { dayKey, durationSec } from './dates'
import type { Entry, EntryKind } from './types'

export const isFeed = (k: EntryKind): boolean => k.startsWith('feed.')

/** The most recent entry matching a predicate (entries are start-ascending). */
export function last(entries: Entry[], pred: (e: Entry) => boolean): Entry | undefined {
  for (let i = entries.length - 1; i >= 0; i--) if (pred(entries[i]!)) return entries[i]
  return undefined
}

/** Entries whose timer is still running (end === null). Most recent first. */
export function running(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.end === null).sort((a, b) => (a.start < b.start ? 1 : -1))
}

export interface DaySummary {
  sleepSec: number
  longestSleepSec: number
  napCount: number
  feedCount: number
  feedVolumeMl: number
  breastSec: number
  diaperTotal: number
  diaperWet: number
  diaperDirty: number
}

export function daySummary(entries: Entry[], key: string): DaySummary {
  const s: DaySummary = { sleepSec: 0, longestSleepSec: 0, napCount: 0, feedCount: 0, feedVolumeMl: 0, breastSec: 0, diaperTotal: 0, diaperWet: 0, diaperDirty: 0 }
  for (const e of entries) {
    if (dayKey(e.start) !== key) continue
    if (e.kind === 'sleep' && e.end) {
      const d = durationSec(e.start, e.end)
      s.sleepSec += d
      s.napCount++
      if (d > s.longestSleepSec) s.longestSleepSec = d
    } else if (isFeed(e.kind)) {
      s.feedCount++
      if (e.volumeMl) s.feedVolumeMl += e.volumeMl
      if (e.leftMl) s.feedVolumeMl += e.leftMl
      if (e.rightMl) s.feedVolumeMl += e.rightMl
      s.breastSec += (e.leftSec ?? 0) + (e.rightSec ?? 0)
    } else if (e.kind === 'diaper') {
      s.diaperTotal++
      if (e.wet) s.diaperWet++
      if (e.dirty) s.diaperDirty++
    }
  }
  return s
}

/** Local day keys for the last `n` days ending today (oldest → newest). */
export function recentDayKeys(n: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push(dayKey(d.toISOString()))
  }
  return out
}

/** The overall date span of a child's log, as local day keys [first, last]. */
export function logSpan(entries: Entry[]): { first: string; last: string } | null {
  if (entries.length === 0) return null
  return { first: dayKey(entries[0]!.start), last: dayKey(entries[entries.length - 1]!.start) }
}

/** All-time headline totals in ONE pass (avoids per-day rescans over a big log). */
export function allTimeTotals(entries: Entry[]): { dayCount: number; sleepSec: number; feeds: number; diapers: number } {
  const days = new Set<string>()
  let sleepSec = 0
  let feeds = 0
  let diapers = 0
  for (const e of entries) {
    days.add(dayKey(e.start))
    if (e.kind === 'sleep' && e.end) sleepSec += durationSec(e.start, e.end)
    else if (isFeed(e.kind)) feeds++
    else if (e.kind === 'diaper') diapers++
  }
  return { dayCount: days.size, sleepSec, feeds, diapers }
}

/** Group entries by local day key, once. Values are start-ascending. */
export function groupByDay(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    const k = dayKey(e.start)
    const arr = map.get(k)
    if (arr) arr.push(e)
    else map.set(k, [e])
  }
  return map
}
