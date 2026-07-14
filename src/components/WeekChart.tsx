// A descriptive daily-rhythm chart: sleep hours, feed count, or diaper count per
// day across a recent window. Surfaces the pattern as it settles in — no
// predictions. CSS bars (crisp, light, accessible).

import { useMemo, useState } from 'react'
import { useStore } from '~/lib/store'
import { dayKey, dayKeyOf, formatDuration } from '~/lib/dates'
import { daySummary } from '~/lib/summary'
import { formatVolume } from '~/lib/units'
import { Segmented } from '~/components/ui'

type Metric = 'sleep' | 'feeds' | 'diapers'
const DAYNAME = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function WeekChart() {
  const { entries, units } = useStore()
  const [metric, setMetric] = useState<Metric>('sleep')
  const [range, setRange] = useState(14)

  // End at the most recent entry's day (so a historical/keepsake log still shows
  // populated bars), else today.
  const endKey = entries.length ? dayKey(entries[entries.length - 1]!.start) : dayKeyOf(new Date())

  const data = useMemo(() => {
    const [ey, em, ed] = endKey.split('-').map(Number)
    const end = new Date(ey!, em! - 1, ed!)
    const days: { key: string; date: Date; value: number; label: string }[] = []
    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)
      const key = dayKeyOf(date)
      const s = daySummary(entries, key)
      let value = 0
      let label = ''
      if (metric === 'sleep') {
        value = s.sleepSec / 3600
        label = s.sleepSec ? formatDuration(s.sleepSec) : ''
      } else if (metric === 'feeds') {
        value = s.feedCount
        label = s.feedCount ? `${s.feedCount}${s.feedVolumeMl ? ` · ${formatVolume(s.feedVolumeMl, units)}` : ''}` : ''
      } else {
        value = s.diaperTotal
        label = s.diaperTotal ? `${s.diaperTotal} (${s.diaperWet}w · ${s.diaperDirty}d)` : ''
      }
      days.push({ key, date, value, label })
    }
    return days
  }, [entries, endKey, metric, range, units])

  const max = Math.max(1, ...data.map((d) => d.value))
  const color = metric === 'sleep' ? '--color-sleep' : metric === 'feeds' ? '--color-feed' : '--color-diaper'
  const avg = data.reduce((a, d) => a + d.value, 0) / data.length
  const avgLabel = metric === 'sleep' ? `${formatDuration(avg * 3600)} sleep` : metric === 'feeds' ? `${avg.toFixed(1)} feeds` : `${avg.toFixed(1)} diapers`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'sleep', label: 'Sleep' },
            { value: 'feeds', label: 'Feeds' },
            { value: 'diapers', label: 'Diapers' },
          ]}
        />
        <Segmented<number> value={range} onChange={setRange} options={[{ value: 7, label: '7d' }, { value: 14, label: '14d' }, { value: 30, label: '30d' }]} />
      </div>

      <div className="flex h-44 items-end gap-1">
        {data.map((d) => {
          const h = (d.value / max) * 100
          return (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date.toLocaleDateString()} · ${d.label || 'nothing logged'}`}>
              <div className="w-full rounded-t" style={{ height: `${Math.max(d.value > 0 ? 3 : 0, h)}%`, background: `var(${color})`, opacity: 0.85 }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <div key={d.key} className="flex-1 text-center text-[10px] text-fg4">
            {range <= 14 ? DAYNAME[d.date.getDay()] : i % 5 === 0 ? d.date.getDate() : ''}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-fg3">
        Daily average over {range} days: <span className="font-medium text-fg2">{avgLabel}</span>
      </div>
    </div>
  )
}
