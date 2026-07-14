// WHO Child Growth Standards, used for descriptive percentile bands behind a
// child's own growth line — context, never a target. LMS parameters (see
// scripts/build-who.mjs) give any percentile as value(z) = M·(1+L·S·z)^(1/L),
// and invert to a z-score / percentile for a measured point.

import whoRaw from '../data/who.json'
import type { Sex } from './types'

interface LMS {
  age: number
  l: number
  m: number
  s: number
}
interface WhoData {
  ageUnit: string
  weight: { m: LMS[]; f: LMS[] }
  length: { m: LMS[]; f: LMS[] }
  head: { m: LMS[]; f: LMS[] }
}

const WHO = whoRaw as WhoData

export type Measure = 'weight' | 'length' | 'head'

/** Canonical z-scores for the bands we draw. */
export const BANDS: { p: number; z: number; label: string }[] = [
  { p: 3, z: -1.88079, label: '3' },
  { p: 15, z: -1.03643, label: '15' },
  { p: 50, z: 0, label: '50' },
  { p: 85, z: 1.03643, label: '85' },
  { p: 97, z: 1.88079, label: '97' },
]

const MAX_AGE = 60

function series(measure: Measure, sex: Sex): LMS[] | null {
  if (sex !== 'm' && sex !== 'f') return null
  return WHO[measure][sex]
}

/** Interpolated LMS at a fractional age in months (clamped to the table range). */
function lmsAt(rows: LMS[], ageMonths: number): LMS | null {
  if (rows.length === 0) return null
  const a = Math.max(0, Math.min(MAX_AGE, ageMonths))
  const lo = Math.floor(a)
  const hi = Math.min(MAX_AGE, lo + 1)
  const rLo = rows[lo]
  const rHi = rows[hi]
  if (!rLo || !rHi) return rows[Math.round(a)] ?? null
  const t = a - lo
  return { age: a, l: rLo.l + (rHi.l - rLo.l) * t, m: rLo.m + (rHi.m - rLo.m) * t, s: rLo.s + (rHi.s - rLo.s) * t }
}

function valueFor(lms: LMS, z: number): number {
  const { l, m, s } = lms
  return Math.abs(l) < 1e-7 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l)
}

/** WHO value (kg for weight, cm for length/head) at a percentile z, or null if
 *  sex is unspecified. */
export function bandValue(measure: Measure, sex: Sex, ageMonths: number, z: number): number | null {
  const rows = series(measure, sex)
  if (!rows) return null
  const lms = lmsAt(rows, ageMonths)
  return lms ? valueFor(lms, z) : null
}

/** All five band curves sampled across [0, maxAge], for drawing. Each is a list
 *  of { age, value }. Value units: kg (weight) / cm (length, head). */
export function bandCurves(measure: Measure, sex: Sex, maxAgeMonths: number, stepMonths = 1): { z: number; p: number; points: { age: number; value: number }[] }[] | null {
  const rows = series(measure, sex)
  if (!rows) return null
  const cap = Math.min(MAX_AGE, Math.max(1, maxAgeMonths))
  return BANDS.map(({ z, p }) => {
    const points: { age: number; value: number }[] = []
    for (let a = 0; a <= cap + 0.001; a += stepMonths) {
      const lms = lmsAt(rows, a)
      if (lms) points.push({ age: a, value: valueFor(lms, z) })
    }
    return { z, p, points }
  })
}

// ── normal CDF (Zelen & Severo approximation) for a point's percentile label ──

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** The percentile (0–100) of a measured value, or null if sex unspecified. */
export function percentileOf(measure: Measure, sex: Sex, ageMonths: number, value: number): number | null {
  const rows = series(measure, sex)
  if (!rows) return null
  const lms = lmsAt(rows, ageMonths)
  if (!lms) return null
  const { l, m, s } = lms
  const z = Math.abs(l) < 1e-7 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s)
  return Math.round(normalCdf(z) * 100)
}

/** "62nd", "3rd", "50th" — an ordinal for a percentile. */
export function ordinal(p: number): string {
  const n = Math.max(1, Math.min(99, p))
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}
