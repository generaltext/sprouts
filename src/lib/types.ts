// The Sprouts domain types. The on-disk shape is append-only event logs (see
// events.ts); these are the folded, in-memory records the UI reads.

import type { Actor } from './events'

export type Sex = 'm' | 'f' | 'u'

/** A child being tracked. Multiple children are first-class — each keeps its own
 *  activity log file, and the UI switches between them. */
export interface Child {
  id: string
  name: string
  /** 'YYYY-MM-DD' calendar birth date (local); '' if unknown. Drives age + growth. */
  birthDate: string
  sex: Sex
  /** #rrggbb accent for this child (tabs, poster default). */
  color: string
  archived: boolean
  createdAt: string
}

/** Someone who logs — a parent, a nanny, a grandparent. NOT a stored record:
 *  identity is per-person (every entry carries its `actor`), so the caregiver
 *  list is *derived* from the distinct actors across the logs (+ the current
 *  user), each given a stable colour hashed from its id. See lib/caregivers.ts. */
export interface Caregiver {
  id: string
  name: string
  color: string
  /** how many entries this person has logged for the active child */
  count: number
}

/** Every kind of thing you can log. "<group>.<variant>" for feeds so they group. */
export type EntryKind =
  | 'sleep'
  | 'feed.bottle'
  | 'feed.breast'
  | 'feed.pump'
  | 'feed.solid'
  | 'diaper'
  | 'growth'
  | 'tummy'
  | 'medicine'
  | 'milestone'
  | 'note'

export type Side = 'left' | 'right'
export type BottleContents = 'breastmilk' | 'formula' | 'mixed'

/** One logged activity. Folded from `entry.log` events (upsert by id). Only the
 *  fields relevant to `kind` are set; everything is optional so the format stays
 *  forward-compatible and a partially-known entry is still valid. */
export interface Entry {
  id: string
  kind: EntryKind
  /** ISO instant the activity started / occurred at. The canonical timestamp. */
  start: string
  /** ISO instant it ended, for duration kinds. `null` means a timer is running. */
  end?: string | null
  note?: string

  // feed.bottle
  volumeMl?: number
  contents?: BottleContents

  // feed.breast
  leftSec?: number
  rightSec?: number
  lastSide?: Side

  // feed.pump
  leftMl?: number
  rightMl?: number

  // feed.solid
  food?: string

  // diaper
  wet?: boolean
  dirty?: boolean
  /** dirty stool colour, freeform (e.g. 'yellow', 'green') */
  stoolColor?: string
  blowout?: boolean

  // growth
  weightG?: number
  heightCm?: number
  headCm?: number

  // tummy / routine, milestone, medicine
  label?: string // tummy/routine label, milestone title
  medName?: string
  dose?: string

  // provenance (folded from the event envelope)
  actor: Actor | null
  updatedAt: string
}

// ── file paths (relative to the app's own data folder) ────────────────────────

export const LOG_DIR = 'v0/logs'

export const PATHS = {
  children: 'v0/children.jsonl',
} as const

// A child's activity log is SHARDED across numbered files that grow FORWARD in
// time: `<childId>.0.jsonl` (oldest) → `.1.jsonl` → `.2.jsonl` → … Shard 0 always
// holds the earliest records; new writes append to the highest-numbered shard and
// only ever ADD a new file when it fills (nothing is ever renamed). Each shard is
// kept under the platform's ~900 KiB single-sync-frame cap, so a multi-year log
// syncs and compacts fine — a single oversized frame is what the server rejects.

/** Keep shards comfortably under the 900 KiB E2EE frame cap (encryption adds a
 *  little overhead; this leaves generous headroom). */
export const SHARD_TARGET_BYTES = 600 * 1024

/** Path of shard `n` for a child. Always numbered, from 0. */
export function shardPath(childId: string, index: number): string {
  return `${LOG_DIR}/${childId}.${index}.jsonl`
}

/** Is `path` one of this child's log shards? Canonical is `<childId>.<n>.jsonl`;
 *  a bare `<childId>.jsonl` is also accepted as shard 0 for read-compatibility. */
export function isLogShard(path: string, childId: string): boolean {
  const base = `${LOG_DIR}/${childId}`
  if (path === `${base}.jsonl`) return true // legacy un-numbered shard (read-only compat)
  if (!path.startsWith(`${base}.`) || !path.endsWith('.jsonl')) return false
  const mid = path.slice(base.length + 1, path.length - '.jsonl'.length)
  return /^\d+$/.test(mid)
}

/** Numeric shard index of a shard path (a bare `<childId>.jsonl` counts as 0). */
export function shardIndex(path: string, childId: string): number {
  const base = `${LOG_DIR}/${childId}`
  if (path === `${base}.jsonl`) return 0
  return Number(path.slice(base.length + 1, path.length - '.jsonl'.length)) || 0
}

// ── display metadata per kind ─────────────────────────────────────────────────

/** Whether a kind spans an interval (sleep/feeds/tummy) or is a point event. */
export function isRanged(kind: EntryKind): boolean {
  return kind === 'sleep' || kind === 'feed.breast' || kind === 'feed.pump' || kind === 'tummy'
}

export const KIND_ORDER: EntryKind[] = [
  'sleep',
  'feed.bottle',
  'feed.breast',
  'feed.pump',
  'feed.solid',
  'diaper',
  'tummy',
  'growth',
  'medicine',
  'milestone',
  'note',
]

export const KIND_LABEL: Record<EntryKind, string> = {
  sleep: 'Sleep',
  'feed.bottle': 'Bottle',
  'feed.breast': 'Nursing',
  'feed.pump': 'Pump',
  'feed.solid': 'Solids',
  diaper: 'Diaper',
  growth: 'Growth',
  tummy: 'Tummy time',
  medicine: 'Medicine',
  milestone: 'Milestone',
  note: 'Note',
}

/** The CSS custom-property name each kind paints with (see global.css). */
export const KIND_VAR: Record<EntryKind, string> = {
  sleep: '--color-sleep',
  'feed.bottle': '--color-feed',
  'feed.breast': '--color-breast',
  'feed.pump': '--color-pump',
  'feed.solid': '--color-feed',
  diaper: '--color-diaper',
  growth: '--color-growth',
  tummy: '--color-tummy',
  medicine: '--color-medicine',
  milestone: '--color-milestone',
  note: '--color-note',
}

export const kindColor = (kind: EntryKind): string => `var(${KIND_VAR[kind]})`

/** A curated, high-contrast palette for new children / caregivers (map-safe hex). */
export const ENTITY_COLORS = [
  '#3f9d52', // sprout
  '#5aa8d6', // sky
  '#e0983f', // amber
  '#d96aa0', // rose
  '#b06fd0', // violet
  '#4faf9a', // teal
  '#d0655a', // clay
  '#7bab54', // leaf
] as const
