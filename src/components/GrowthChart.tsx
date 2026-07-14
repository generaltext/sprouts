// Growth over age, with WHO percentile bands behind the child's own line.
// Descriptive context (where the child sits on the curve), never a target.
// Hand-rolled SVG so it stays bundle-light and CSP-clean.

import { useMemo, useState } from 'react'
import { useStore } from '~/lib/store'
import { ageMonthsFractional } from '~/lib/dates'
import { cmToIn } from '~/lib/units'
import { bandCurves, ordinal, percentileOf, type Measure } from '~/lib/who'
import { Segmented } from '~/components/ui'
import type { Entry } from '~/lib/types'

const W = 640
const H = 320
const PAD = { l: 44, r: 16, t: 16, b: 30 }

const MEASURES: { value: Measure; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Height' },
  { value: 'head', label: 'Head' },
]

export function GrowthChart() {
  const { entries, activeChild, units } = useStore()
  const [measure, setMeasure] = useState<Measure>('weight')

  const getField = (e: Entry): number | undefined =>
    measure === 'weight' ? e.weightG : measure === 'length' ? e.heightCm : e.headCm
  const toDisplay = (canonical: number) => {
    if (measure === 'weight') return units === 'metric' ? canonical / 1000 : canonical / 453.592 // g → kg | lb
    return units === 'metric' ? canonical : cmToIn(canonical) // cm → cm | in
  }
  // WHO bands are kg / cm; convert to the same display unit as the points.
  const bandToDisplay = (v: number) => (measure === 'weight' ? (units === 'metric' ? v : v / 0.453592) : units === 'metric' ? v : cmToIn(v))
  const unitLabel = measure === 'weight' ? (units === 'metric' ? 'kg' : 'lb') : units === 'metric' ? 'cm' : 'in'

  const points = useMemo(() => {
    if (!activeChild?.birthDate) return []
    const out: { age: number; value: number; raw: number }[] = []
    for (const e of entries) {
      if (e.kind !== 'growth') continue
      const raw = getField(e)
      if (raw == null) continue
      const age = ageMonthsFractional(activeChild.birthDate, e.start) ?? 0
      out.push({ age, value: toDisplay(raw), raw })
    }
    return out.sort((a, b) => a.age - b.age)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, activeChild, units, measure])

  const maxAge = Math.max(3, Math.ceil((points.at(-1)?.age ?? 3) + 1))
  const bands = useMemo(() => (activeChild ? bandCurves(measure, activeChild.sex, maxAge) : null), [measure, activeChild, maxAge])

  if (!activeChild?.birthDate) {
    return <Empty msg="Add a birth date to this child to see growth against age." />
  }
  if (points.length === 0) {
    return <Empty msg={`No ${MEASURES.find((m) => m.value === measure)!.label.toLowerCase()} logged yet. Log a growth entry to start the chart.`} />
  }

  // y-domain from bands (if any) and points, with a little padding.
  const bandVals = bands ? bands.flatMap((b) => b.points.map((p) => bandToDisplay(p.value))) : []
  const allVals = [...bandVals, ...points.map((p) => p.value)]
  const yMin = Math.min(...allVals) * 0.96
  const yMax = Math.max(...allVals) * 1.04

  const x = (age: number) => PAD.l + (age / maxAge) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b)

  const line = (pts: { age: number; value: number }[], conv: (v: number) => number) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.age).toFixed(1)},${y(conv(p.value)).toFixed(1)}`).join(' ')

  const latest = points.at(-1)!
  // Percentile from the canonical value (kg / cm), matching the WHO tables.
  const pctClean = activeChild.sex !== 'u' ? percentileOf(measure, activeChild.sex, latest.age, measure === 'weight' ? latest.raw / 1000 : latest.raw) : null

  const yTicks = ticks(yMin, yMax, 4)
  const xTicks = ticks(0, maxAge, Math.min(6, maxAge))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Segmented<Measure> value={measure} onChange={setMeasure} options={MEASURES} />
        {pctClean != null && (
          <span className="text-sm text-fg2">
            Latest: <span className="font-semibold text-fg">{ordinal(pctClean)}</span> percentile
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Growth chart">
        {/* y grid + labels */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-fg3)">
              {round(t)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill="var(--color-fg3)">
            {t}mo
          </text>
        ))}

        {/* WHO bands */}
        {bands?.map((b) => (
          <g key={b.p}>
            <path d={line(b.points, bandToDisplay)} fill="none" stroke="var(--color-growth)" strokeOpacity={b.p === 50 ? 0.5 : 0.22} strokeWidth={b.p === 50 ? 1.5 : 1} strokeDasharray={b.p === 50 ? '' : '3 3'} />
            <text x={W - PAD.r} y={y(bandToDisplay(b.points.at(-1)!.value)) - 2} textAnchor="end" fontSize={9} fill="var(--color-growth)" fillOpacity={0.7}>
              {b.p}
            </text>
          </g>
        ))}

        {/* child line + points */}
        <path d={line(points, (v) => v)} fill="none" stroke={activeChild.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.age)} cy={y(p.value)} r={3.5} fill={activeChild.color} stroke="var(--color-panel)" strokeWidth={1.5} />
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-between text-xs text-fg3">
        <span>Age (months)</span>
        <span>
          {unitLabel}
          {activeChild.sex === 'u' && ' · add a sex on the profile for WHO bands'}
        </span>
      </div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-10 text-center text-sm text-fg3">{msg}</div>
}

function ticks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min]
  const step = (max - min) / count
  const out: number[] = []
  for (let i = 0; i <= count; i++) out.push(min + step * i)
  return out
}
function round(n: number): number {
  return Math.round(n * 10) / 10
}
