// Units. We store canonical SI internally (millilitres, grams, centimetres) and
// render through a per-user display preference. The preference is UI-local
// (localStorage) — a viewing choice, not synced data.

export type UnitSystem = 'imperial' | 'metric'

const ML_PER_FLOZ = 29.5735
const G_PER_LB = 453.592
const G_PER_OZ = 28.3495
const CM_PER_IN = 2.54

const PREF_KEY = 'sprouts.units'

export function getUnitPref(): UnitSystem {
  return localStorage.getItem(PREF_KEY) === 'metric' ? 'metric' : 'imperial'
}
export function setUnitPref(u: UnitSystem): void {
  localStorage.setItem(PREF_KEY, u)
}

// ── volume (feeds, pumping) ───────────────────────────────────────────────────

export const flozToMl = (floz: number) => floz * ML_PER_FLOZ
export const mlToFloz = (ml: number) => ml / ML_PER_FLOZ

/** "4.5 fl oz" or "133 ml". */
export function formatVolume(ml: number, u: UnitSystem = getUnitPref()): string {
  if (u === 'metric') return `${Math.round(ml)} ml`
  const floz = mlToFloz(ml)
  return `${round1(floz)} fl oz`
}
export const volumeUnitLabel = (u: UnitSystem = getUnitPref()) => (u === 'metric' ? 'ml' : 'fl oz')
/** parse a number the user typed in the display unit → canonical ml */
export const volumeToMl = (value: number, u: UnitSystem = getUnitPref()) => (u === 'metric' ? value : flozToMl(value))
export const mlToDisplay = (ml: number, u: UnitSystem = getUnitPref()) => (u === 'metric' ? Math.round(ml) : round1(mlToFloz(ml)))

// ── weight (growth) ───────────────────────────────────────────────────────────

export const lbOzToG = (lb: number, oz: number) => lb * G_PER_LB + oz * G_PER_OZ
export const gToLbOz = (g: number) => {
  const totalOz = g / G_PER_OZ
  const lb = Math.floor(totalOz / 16)
  const oz = totalOz - lb * 16
  return { lb, oz }
}

/** "13 lb 4 oz" or "6.01 kg". */
export function formatWeight(g: number, u: UnitSystem = getUnitPref()): string {
  if (u === 'metric') return `${round2(g / 1000)} kg`
  // Round to whole ounces first, then split — so 15.998 oz rolls to the next lb
  // (avoids "33 lb 16 oz").
  const totalOz = Math.round(g / G_PER_OZ)
  const lb = Math.floor(totalOz / 16)
  const oz = totalOz % 16
  return `${lb} lb ${oz} oz`
}

// ── length (height, head) ─────────────────────────────────────────────────────

export const inToCm = (inch: number) => inch * CM_PER_IN
export const cmToIn = (cm: number) => cm / CM_PER_IN

/** "24.5 in" or "62.2 cm". */
export function formatLength(cm: number, u: UnitSystem = getUnitPref()): string {
  if (u === 'metric') return `${round1(cm)} cm`
  return `${round1(cmToIn(cm))} in`
}
export const lengthUnitLabel = (u: UnitSystem = getUnitPref()) => (u === 'metric' ? 'cm' : 'in')

// ── helpers ───────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
