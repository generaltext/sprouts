// Time helpers for a baby log. Entries store ISO instants (UTC); we display and
// group in the viewer's local time, which is what a parent means by "yesterday".

const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local calendar-day key 'YYYY-MM-DD' for grouping a timeline by day. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM-DD' key for a Date. */
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "3:45 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${pad2(m)} ${ap}`
}

/** "Mon, Apr 9" (adds the year only if it isn't the current one). */
export function formatDayLabel(key: string, now = new Date()): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1)
  const today = dayKeyOf(now)
  const yesterday = dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  const base = `${DAYNAMES[date.getDay()]}, ${MONTHS[(m ?? 1) - 1]} ${d}`
  return y === now.getFullYear() ? base : `${base}, ${y}`
}

/** Seconds between two ISO instants (b defaults to now). */
export function durationSec(startIso: string, endIso?: string | null): number {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 1000))
}

/** "1h 20m", "45m", "2h", "30s". Compact, tabular-friendly. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** "2h 10m ago", "just now", scaling to days/months/years for older records
 *  (so a keepsake log doesn't read "22287h ago"). For the "time since" strip. */
export function formatAgo(fromIso: string, nowMs = Date.now()): string {
  const sec = Math.max(0, Math.round((nowMs - new Date(fromIso).getTime()) / 1000))
  if (sec < 45) return 'just now'
  const days = Math.floor(sec / 86_400)
  if (days >= 365) {
    const y = Math.floor(days / 365)
    return `${y}y ago`
  }
  if (days >= 60) return `${Math.floor(days / 30)}mo ago`
  if (days >= 2) return `${days}d ago`
  return `${formatDuration(sec)} ago`
}

export interface Age {
  days: number
  weeks: number
  months: number
  /** human label, e.g. "6 days", "5 weeks", "3mo 12d", "2y 4mo" */
  label: string
}

/** Age of a child (birthDate 'YYYY-MM-DD') at an instant (defaults to now). */
export function ageAt(birthDate: string, atIso?: string): Age | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  if (!by || !bm || !bd) return null
  const birth = new Date(by, bm - 1, bd)
  const at = atIso ? new Date(atIso) : new Date()
  const days = Math.floor((at.getTime() - birth.getTime()) / 86_400_000)
  const weeks = Math.floor(days / 7)
  // whole months between the dates
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth())
  if (at.getDate() < birth.getDate()) months--
  months = Math.max(0, months)

  let label: string
  if (days < 0) label = 'not yet born'
  else if (days < 14) label = `${days} ${days === 1 ? 'day' : 'days'}`
  else if (weeks < 13) label = `${weeks} weeks`
  else if (months < 24) {
    // days into the current month
    const monthStart = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate())
    const dRem = Math.floor((at.getTime() - monthStart.getTime()) / 86_400_000)
    label = dRem > 0 ? `${months}mo ${dRem}d` : `${months}mo`
  } else {
    const y = Math.floor(months / 12)
    const moRem = months % 12
    label = moRem > 0 ? `${y}y ${moRem}mo` : `${y}y`
  }
  return { days, weeks, months, label }
}

// ── <input type="datetime-local"> bridging (local wall-clock ⇄ ISO instant) ────

/** ISO instant → 'YYYY-MM-DDTHH:mm' in local time, for a datetime-local input. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' (local) → ISO instant. '' → '' (caller decides). */
export function fromLocalInput(v: string): string {
  if (!v) return ''
  const d = new Date(v) // datetime-local parses as local time
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** Now, as a datetime-local value. */
export function nowLocalInput(): string {
  return toLocalInput(new Date().toISOString())
}

/** 'YYYY-MM-DD' (local) for a date input; '' if the iso is empty. */
export function toDateInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Age in fractional months (for placing a growth point on the WHO curves). */
export function ageMonthsFractional(birthDate: string, atIso: string): number | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  if (!by || !bm || !bd) return null
  const birth = new Date(by, bm - 1, bd).getTime()
  const at = new Date(atIso).getTime()
  const days = (at - birth) / 86_400_000
  return days < 0 ? 0 : days / 30.4375
}
