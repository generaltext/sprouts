// Trends: descriptive summaries. A recent-rhythm chart (sleep / feeds / diapers
// per day) and a growth chart with WHO percentile bands. All read-only — the
// record, surfaced. No predictions.

import { useMemo } from 'react'
import { useStore } from '~/lib/store'
import { formatDuration } from '~/lib/dates'
import { allTimeTotals } from '~/lib/summary'
import { WeekChart } from '~/components/WeekChart'
import { GrowthChart } from '~/components/GrowthChart'

export function Trends() {
  const { entries } = useStore()

  // All-time headline totals (a gentle keepsake stat, not a judgment). One pass.
  const totals = useMemo(() => allTimeTotals(entries), [entries])

  if (entries.length === 0) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center text-sm text-fg3">Log a few activities to see trends here.</div>
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
      {/* all-time totals */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Big label="Days logged" value={String(totals.dayCount)} />
        <Big label="Total sleep" value={formatDuration(totals.sleepSec)} color="--color-sleep" />
        <Big label="Feeds" value={String(totals.feeds)} color="--color-feed" />
        <Big label="Diapers" value={String(totals.diapers)} color="--color-diaper" />
      </div>

      <section className="card p-4">
        <h3 className="mb-3 font-serif text-base font-semibold">Daily rhythm</h3>
        <WeekChart />
      </section>

      <section className="card p-4">
        <h3 className="mb-3 font-serif text-base font-semibold">Growth</h3>
        <GrowthChart />
      </section>

      <p className="px-1 text-center text-xs text-fg4">
        {entries.length} activities logged. Sprouts shows what happened, not what should. No predictions.
      </p>
    </div>
  )
}

function Big({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg3">{label}</div>
      <div className="tnum text-2xl font-semibold" style={color ? { color: `var(${color})` } : undefined}>
        {value}
      </div>
    </div>
  )
}
