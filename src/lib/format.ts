// Render an entry as a human title + a compact detail line, unit-aware. Pure
// strings, so both the timeline and the dashboard cards read the same.

import { durationSec, formatDuration, formatTime } from './dates'
import { formatLength, formatVolume, formatWeight, type UnitSystem } from './units'
import { KIND_LABEL, type Entry } from './types'

/** Primary label for an entry (the kind, specialized where it helps). */
export function entryTitle(e: Entry): string {
  if (e.kind === 'feed.bottle') {
    const c = e.contents === 'formula' ? 'Formula' : e.contents === 'mixed' ? 'Bottle (mixed)' : 'Bottle'
    return c
  }
  if (e.kind === 'diaper') {
    if (e.wet && e.dirty) return 'Diaper · wet + dirty'
    if (e.dirty) return 'Diaper · dirty'
    if (e.wet) return 'Diaper · wet'
    return 'Diaper'
  }
  if (e.kind === 'milestone') return e.label || 'Milestone'
  if (e.kind === 'tummy') return e.label || 'Tummy time'
  if (e.kind === 'medicine') return e.medName || 'Medicine'
  return KIND_LABEL[e.kind]
}

/** The detail line (duration, volume, sides, measurements…). */
export function entryDetail(e: Entry, units: UnitSystem): string {
  switch (e.kind) {
    case 'sleep': {
      if (e.end === null) return `running · ${formatDuration(durationSec(e.start, null))}`
      if (e.end) return formatDuration(durationSec(e.start, e.end))
      return ''
    }
    case 'feed.bottle':
      return e.volumeMl ? formatVolume(e.volumeMl, units) : ''
    case 'feed.breast': {
      if (e.end === null) return `running · ${formatDuration(durationSec(e.start, null))}`
      const parts: string[] = []
      const sides = (e.leftSec ?? 0) + (e.rightSec ?? 0)
      const total = sides > 0 ? sides : e.end ? durationSec(e.start, e.end) : 0
      if (total > 0) parts.push(formatDuration(total))
      if (e.leftSec || e.rightSec) parts.push(`L ${formatDuration(e.leftSec ?? 0)} · R ${formatDuration(e.rightSec ?? 0)}`)
      return parts.join(' · ')
    }
    case 'feed.pump': {
      if (e.end === null) return `running · ${formatDuration(durationSec(e.start, null))}`
      const vol = (e.leftMl ?? 0) + (e.rightMl ?? 0)
      return vol > 0 ? formatVolume(vol, units) : e.end ? formatDuration(durationSec(e.start, e.end)) : ''
    }
    case 'feed.solid':
      return e.food ?? ''
    case 'diaper':
      return [e.stoolColor, e.blowout ? 'blowout' : ''].filter(Boolean).join(' · ')
    case 'growth': {
      const parts: string[] = []
      if (e.weightG) parts.push(formatWeight(e.weightG, units))
      if (e.heightCm) parts.push(formatLength(e.heightCm, units))
      if (e.headCm) parts.push(`head ${formatLength(e.headCm, units)}`)
      return parts.join(' · ')
    }
    case 'tummy':
      return e.end ? formatDuration(durationSec(e.start, e.end)) : e.end === null ? 'running' : ''
    case 'medicine':
      return e.dose ?? ''
    case 'milestone':
      return ''
    case 'note':
      return ''
  }
}

/** The time span shown on a row: "3:45 PM" or "1:00 – 2:30 PM" for ranged. */
export function entryTimeLabel(e: Entry): string {
  if (e.end) return `${formatTime(e.start)} – ${formatTime(e.end)}`
  return formatTime(e.start)
}
