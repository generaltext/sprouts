// The timeline: every activity, grouped by day (most recent first), each day
// with a quiet summary line. Filterable by who logged. Days render incrementally
// (a few at a time, more as you scroll) so a multi-year log stays snappy instead
// of mounting thousands of rows at once.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '~/lib/store'
import { formatDayLabel, formatDuration } from '~/lib/dates'
import { daySummary, groupByDay } from '~/lib/summary'
import { formatVolume } from '~/lib/units'
import { Chip } from '~/components/ui'
import { EntryCard } from '~/components/EntryCard'

const CHUNK = 10 // days rendered per step

export function Timeline() {
  const { entries, caregivers, units } = useStore()
  const [who, setWho] = useState<string | null>(null) // actor id, or null = everyone
  const [shown, setShown] = useState(CHUNK)
  const sentinel = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => (who ? entries.filter((e) => e.actor?.id === who) : entries), [entries, who])

  // Day sections, newest first. Grouping is one O(n) pass; we render a window.
  const days = useMemo(() => {
    const map = groupByDay(filtered)
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, list]) => ({ key, list: [...list].sort((a, b) => (a.start < b.start ? 1 : -1)) }))
  }, [filtered])

  // Reset the window when the filter changes.
  useEffect(() => setShown(CHUNK), [who])

  // Infinite scroll: reveal more days as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (obs) => {
        if (obs.some((o) => o.isIntersecting)) setShown((s) => Math.min(days.length, s + CHUNK))
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [days.length])

  const visible = days.slice(0, shown)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      {caregivers.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Chip active={who === null} onClick={() => setWho(null)}>
            Everyone
          </Chip>
          {caregivers.map((c) => (
            <Chip key={c.id} active={who === c.id} onClick={() => setWho(c.id)} color={c.color}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <div className="py-16 text-center text-sm text-fg3">Nothing logged yet.</div>
      ) : (
        <div className="space-y-5">
          {visible.map(({ key, list }) => {
            const s = daySummary(list, key)
            const bits: string[] = []
            if (s.sleepSec) bits.push(`${formatDuration(s.sleepSec)} sleep`)
            if (s.feedCount) bits.push(`${s.feedCount} feeds${s.feedVolumeMl ? ` · ${formatVolume(s.feedVolumeMl, units)}` : ''}`)
            if (s.diaperTotal) bits.push(`${s.diaperTotal} diapers`)
            return (
              <section key={key}>
                <div className="sticky top-0 z-10 -mx-1 flex items-baseline justify-between bg-bg/90 px-1 py-1.5 backdrop-blur-sm">
                  <h3 className="font-serif text-sm font-semibold text-fg">{formatDayLabel(key)}</h3>
                  {bits.length > 0 && <span className="truncate pl-2 text-xs text-fg3">{bits.join('  ·  ')}</span>}
                </div>
                <div className="card mt-1 p-1">
                  <div className="divide-y divide-line/60">
                    {list.map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
          {shown < days.length && (
            <div ref={sentinel} className="py-4 text-center text-xs text-fg4">
              Loading earlier days… ({days.length - shown} more)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
