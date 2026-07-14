// The home dashboard: running timers, one-tap quick-log, a "time since last…"
// strip, today at a glance, and the most recent activity. Glanceable and calm.

import { useState } from 'react'
import { MoreHorizontal, Square } from 'lucide-react'
import { useStore } from '~/lib/store'
import { useNow } from '~/hooks/use-now'
import { daySummary, isFeed, last, running } from '~/lib/summary'
import { dayKeyOf, formatAgo, formatDuration } from '~/lib/dates'
import { formatVolume } from '~/lib/units'
import { kindColor, KIND_LABEL, type EntryKind } from '~/lib/types'
import { KIND_ICON } from '~/components/icons'
import { EntryCard } from '~/components/EntryCard'
import { EntryEditor } from '~/components/EntryEditor'

const PRIMARY: { kind: EntryKind; mode: 'timer' | 'editor' }[] = [
  { kind: 'sleep', mode: 'timer' },
  { kind: 'feed.bottle', mode: 'editor' },
  { kind: 'feed.breast', mode: 'timer' },
  { kind: 'feed.pump', mode: 'timer' },
  { kind: 'diaper', mode: 'editor' },
]
const MORE: EntryKind[] = ['feed.solid', 'tummy', 'growth', 'medicine', 'milestone', 'note']

// A running timer this long prompts a gentle "still going?" nudge.
const NUDGE_SEC: Partial<Record<EntryKind, number>> = { sleep: 6 * 3600, 'feed.breast': 3600, 'feed.pump': 2 * 3600 }

export function Dashboard() {
  const { entries, logEntry, updateEntry, units } = useStore()
  const now = useNow(30_000)
  const [editorKind, setEditorKind] = useState<EntryKind | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const runningList = running(entries)
  const todayKey = dayKeyOf(new Date(now))
  const today = daySummary(entries, todayKey)

  const lastFeed = last(entries, (e) => isFeed(e.kind) && e.end !== null)
  const lastDiaper = last(entries, (e) => e.kind === 'diaper')
  const lastSleep = last(entries, (e) => e.kind === 'sleep' && !!e.end)

  const startTimer = (kind: EntryKind) => logEntry({ kind, start: new Date().toISOString(), end: null })
  const stopTimer = (id: string, kind: EntryKind, start: string) => updateEntry(id, { kind, start, end: new Date().toISOString() })

  const onQuick = (kind: EntryKind, mode: 'timer' | 'editor') => {
    if (mode === 'timer') void startTimer(kind)
    else setEditorKind(kind)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5">
      {/* running timers */}
      {runningList.length > 0 && (
        <div className="space-y-2">
          {runningList.map((e) => {
            const sec = Math.round((now - new Date(e.start).getTime()) / 1000)
            const nudge = NUDGE_SEC[e.kind] != null && sec > NUDGE_SEC[e.kind]!
            const Icon = KIND_ICON[e.kind]
            return (
              <div key={e.id} className="card card-shadow flex items-center gap-3 p-3" style={{ borderColor: kindColor(e.kind) }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${kindColor(e.kind)} 18%, transparent)`, color: kindColor(e.kind) }}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg">{KIND_LABEL[e.kind]} in progress</div>
                  <div className="tnum text-lg font-semibold text-fg" style={{ color: kindColor(e.kind) }}>
                    {formatDuration(sec)}
                  </div>
                  {nudge && <div className="text-xs text-warn">Still going? Tap stop when it ends.</div>}
                </div>
                <button
                  type="button"
                  onClick={() => stopTimer(e.id, e.kind, e.start)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
                >
                  <Square size={14} /> Stop
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* quick log */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {PRIMARY.map(({ kind, mode }) => (
          <QuickButton key={kind} kind={kind} onClick={() => onQuick(kind, mode)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line2 bg-panel px-2 py-3 text-fg3 transition-colors hover:bg-panel-2"
        >
          <MoreHorizontal size={22} />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
      {moreOpen && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {MORE.map((kind) => (
            <QuickButton key={kind} kind={kind} onClick={() => { setEditorKind(kind); setMoreOpen(false) }} />
          ))}
        </div>
      )}

      {/* time since */}
      <div className="grid grid-cols-3 gap-2.5">
        <SincePill label="Last fed" value={lastFeed ? formatAgo(lastFeed.start, now) : '·'} color="--color-feed" />
        <SincePill label="Last diaper" value={lastDiaper ? formatAgo(lastDiaper.start, now) : '·'} color="--color-diaper" />
        <SincePill label="Last slept" value={lastSleep?.end ? formatAgo(lastSleep.end, now) : '·'} color="--color-sleep" />
      </div>

      {/* today at a glance */}
      <div className="card p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg3">Today at a glance</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Sleep" value={today.sleepSec ? formatDuration(today.sleepSec) : '·'} sub={today.napCount ? `${today.napCount} sleeps` : ''} color="--color-sleep" />
          <Stat label="Feeds" value={String(today.feedCount || '·')} sub={today.feedVolumeMl ? formatVolume(today.feedVolumeMl, units) : today.breastSec ? formatDuration(today.breastSec) : ''} color="--color-feed" />
          <Stat label="Diapers" value={String(today.diaperTotal || '·')} sub={today.diaperTotal ? `${today.diaperWet} wet · ${today.diaperDirty} dirty` : ''} color="--color-diaper" />
          <Stat label="Longest sleep" value={today.longestSleepSec ? formatDuration(today.longestSleepSec) : '·'} sub="" color="--color-sleep" />
        </div>
      </div>

      {/* recent */}
      {entries.length > 0 && (
        <div className="card p-2">
          <div className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg3">Recent</div>
          <div className="divide-y divide-line/60">
            {[...entries].slice(-8).reverse().map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </div>
      )}

      {editorKind && <EntryEditor kind={editorKind} onClose={() => setEditorKind(null)} />}
    </div>
  )
}

function QuickButton({ kind, onClick }: { kind: EntryKind; onClick: () => void }) {
  const Icon = KIND_ICON[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line2 bg-panel px-2 py-3 transition-colors hover:bg-panel-2"
      style={{ color: kindColor(kind) }}
    >
      <Icon size={22} />
      <span className="text-xs font-medium text-fg2">{KIND_LABEL[kind]}</span>
    </button>
  )
}

function SincePill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card flex flex-col gap-0.5 p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg3">{label}</span>
      <span className="tnum text-sm font-semibold" style={{ color: `var(${color})` }}>{value}</span>
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg3">{label}</div>
      <div className="tnum text-xl font-semibold" style={{ color: `var(${color})` }}>{value}</div>
      {sub && <div className="text-xs text-fg3">{sub}</div>}
    </div>
  )
}
