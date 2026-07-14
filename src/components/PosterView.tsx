// PosterView — turn the whole log into print-ready wall art. Two styles (stacked
// day-rows, radial spiral), palettes, layers, and a date range. Preview and
// export share one renderer (lib/poster.ts), so the PNG matches the preview.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useStore } from '~/lib/store'
import { buildPosterData, type PosterDay } from '~/lib/poster-data'
import { drawPoster, POSTER_THEMES, type PosterOptions, type PosterTheme } from '~/lib/poster'
import { Field, Segmented } from '~/components/ui'

type RangeKey = 'all' | 'y1' | 'y2' | 'last12' | 'last6' | 'last3'
const DAY = 86_400_000

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const my = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`

export function PosterView({ onClose }: { onClose: () => void }) {
  const { entries, activeChild } = useStore()
  const previewRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const data = useMemo(() => buildPosterData(entries, activeChild?.birthDate), [entries, activeChild])

  const [style, setStyle] = useState<'rows' | 'spiral'>('rows')
  const [theme, setTheme] = useState<PosterTheme>(POSTER_THEMES[0]!)
  const [title, setTitle] = useState(activeChild?.name ?? 'Sprouts')
  const [subtitle, setSubtitle] = useState('')
  const [showFeeds, setShowFeeds] = useState(false)
  const [showDiapers, setShowDiapers] = useState(false)
  const [useChildColor, setUseChildColor] = useState(false)
  const [range, setRange] = useState<RangeKey>('all')

  const days = useMemo<PosterDay[]>(() => (data ? filterDays(data.days, range) : []), [data, range])

  // Default subtitle to the actual span shown.
  useEffect(() => {
    if (days.length === 0) return
    setSubtitle(`${my(days[0]!.date)} – ${my(days[days.length - 1]!.date)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, data])

  const dims = style === 'rows' ? { w: 2400, h: 3400 } : { w: 3000, h: 3000 }
  const opts: PosterOptions = useMemo(
    () => ({ style, theme, title, subtitle, showFeeds, showDiapers, sleepColor: useChildColor ? activeChild?.color : undefined }),
    [style, theme, title, subtitle, showFeeds, showDiapers, useChildColor, activeChild],
  )

  // live preview, scaled to fit
  useEffect(() => {
    const canvas = previewRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || days.length === 0) return
    const render = () => {
      const maxW = wrap.clientWidth - 32
      const maxH = wrap.clientHeight - 32
      if (maxW <= 0 || maxH <= 0) return
      const scale = Math.min(maxW / dims.w, maxH / dims.h)
      const cssW = Math.round(dims.w * scale)
      const cssH = Math.round(dims.h * scale)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawPoster(ctx, cssW, cssH, days, opts)
    }
    render()
    const ro = new ResizeObserver(render)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [opts, days, dims.w, dims.h])

  const download = () => {
    const off = document.createElement('canvas')
    off.width = dims.w
    off.height = dims.h
    const ctx = off.getContext('2d')!
    drawPoster(ctx, dims.w, dims.h, days, opts)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'sprouts').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-poster.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(10,16,10,0.6)] backdrop-blur-sm sm:flex-row">
      {/* preview */}
      <div ref={wrapRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
        {days.length > 0 ? (
          <canvas ref={previewRef} className="rounded-lg shadow-2xl" />
        ) : (
          <div className="rounded-lg bg-panel px-6 py-4 text-sm text-fg3">Log some sleep to build a poster.</div>
        )}
      </div>

      {/* controls */}
      <div className="scroll-thin flex w-full shrink-0 flex-col overflow-y-auto border-t border-line bg-panel sm:w-80 sm:border-l sm:border-t-0">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h2 className="font-serif text-lg font-semibold">Poster</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-fg3 hover:bg-panel-2 hover:text-fg" aria-label="Close poster">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-3">
          <Field label="Style">
            <Segmented<'rows' | 'spiral'> value={style} onChange={setStyle} options={[{ value: 'rows', label: 'Day rows' }, { value: 'spiral', label: 'Spiral' }]} />
          </Field>

          <Field label="Range">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['y1', 'Year 1'],
                  ['y2', 'Year 2'],
                  ['last3', 'Last 3mo'],
                  ['last6', 'Last 6mo'],
                  ['last12', 'Last 12mo'],
                ] as [RangeKey, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRange(k)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium ${range === k ? 'border-accent bg-accent-soft text-fg' : 'border-line2 text-fg3 hover:bg-panel-2'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>
          <Field label="Subtitle">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>

          <Field label="Palette">
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${theme.name === t.name ? 'border-accent text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'}`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: t.bg }} />
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Layers">
            <div className="space-y-1.5">
              <Toggle label="Feed marks" checked={showFeeds} onChange={setShowFeeds} />
              <Toggle label="Diaper marks" checked={showDiapers} onChange={setShowDiapers} />
              {activeChild && <Toggle label={`Sleep in ${activeChild.name}'s colour`} checked={useChildColor} onChange={setUseChildColor} />}
            </div>
          </Field>
        </div>

        <div className="mt-auto border-t border-line p-3">
          <button
            type="button"
            onClick={download}
            disabled={days.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-40"
          >
            <Download size={16} />
            Download PNG
          </button>
          <p className="mt-2 text-center text-xs text-fg4">
            {dims.w}×{dims.h}px · print-ready
          </p>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-fg2 hover:bg-panel-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
      {label}
    </label>
  )
}

function filterDays(days: PosterDay[], range: RangeKey): PosterDay[] {
  if (days.length === 0 || range === 'all') return days
  const first = days[0]!.date.getTime()
  const last = days[days.length - 1]!.date.getTime()
  let from = first
  let to = last
  if (range === 'y1') to = first + 365 * DAY
  else if (range === 'y2') {
    from = first + 365 * DAY
    to = first + 730 * DAY
  } else if (range === 'last3') from = last - 92 * DAY
  else if (range === 'last6') from = last - 183 * DAY
  else if (range === 'last12') from = last - 365 * DAY
  return days.filter((d) => d.date.getTime() >= from && d.date.getTime() <= to)
}
