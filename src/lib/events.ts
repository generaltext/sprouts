// The event envelope. One JSON object per line; immutable once written. Every
// change to Sprouts is an event of the form "<entity>.<verb>":
//
//   child.create | child.update | child.archive        (subject = childId)
//   caregiver.create | caregiver.update | caregiver.remove   (subject = caregiverId)
//   entry.log | entry.remove                            (subject = entryId)
//
// `entry.log` is an upsert — logging an activity, or later editing it, is the
// same event re-appended with the new values (last-writer-wins in the fold). We
// never rewrite a line, which is what keeps concurrent appends from two phones
// merging cleanly. Children / caregivers live in their own small files; each
// child's activities live in that child's own log file (see PATHS).

export interface Actor {
  id: string
  name: string
}

export interface SproutsEvent {
  /** evt_<ulid> — unique, sortable, used for dedupe/idempotency */
  id: string
  /** ISO timestamp from the writing client (LWW tiebreak + audit) */
  ts: string
  /** who wrote it, from gt.user() (or a local fallback); null if unknown */
  actor: Actor | null
  /** "<entity>.<verb>" */
  type: string
  /** the id of the record this event is about */
  subject: string
  /** verb-specific payload */
  data?: Record<string, unknown>
}

/** A change to append, before the envelope is stamped (id/ts/actor added by the store). */
export interface Draft {
  type: string
  subject: string
  data?: Record<string, unknown>
}

export function serializeEvent(ev: SproutsEvent): string {
  return JSON.stringify(ev)
}

export function parseEvent(line: string): SproutsEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed) as SproutsEvent
    if (typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.subject === 'string') {
      return obj
    }
  } catch {
    // A malformed line (a half-synced write, a hand-edit) is skipped, not fatal.
  }
  return null
}

/** Parse every line of a JSONL file into events, skipping blanks/garbage. */
export function parseAll(text: string): SproutsEvent[] {
  const out: SproutsEvent[] = []
  for (const line of text.split('\n')) {
    const ev = parseEvent(line)
    if (ev) out.push(ev)
  }
  return out
}
