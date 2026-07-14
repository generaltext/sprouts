// The poster renderer — one function draws both styles on a canvas, used for the
// live preview AND the high-res PNG export, so what you see is what downloads.
// Pure drawing: give it a context, a size, the prepared days, and options.

import type { PosterDay } from './poster-data'

export interface PosterTheme {
  name: string
  bg: string
  track: string // faint 24h "awake" band
  sleep: string
  feed: string
  diaper: string
  fg: string // title
  sub: string // subtitle / faint labels
}

export const POSTER_THEMES: PosterTheme[] = [
  { name: 'Night', bg: '#0c1322', track: '#161f33', sleep: '#6b7fd0', feed: '#e0983f', diaper: '#4faf9a', fg: '#eef2fb', sub: '#8794b5' },
  { name: 'Paper', bg: '#f4efe4', track: '#e7dfcc', sleep: '#4a5d99', feed: '#c8801f', diaper: '#3f8f7c', fg: '#2a2418', sub: '#8a8069' },
  { name: 'Meadow', bg: '#0f1a12', track: '#182619', sleep: '#7fa9e0', feed: '#e6b054', diaper: '#57c3ab', fg: '#eaf3ea', sub: '#7f9080' },
  { name: 'Dusk', bg: '#241826', track: '#33223a', sleep: '#b98fe0', feed: '#e88f6a', diaper: '#5ec5c0', fg: '#f4ecf6', sub: '#9d86a6' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface PosterOptions {
  style: 'rows' | 'spiral'
  theme: PosterTheme
  title: string
  subtitle: string
  showFeeds: boolean
  showDiapers: boolean
  /** override the sleep colour (e.g. the child's colour); falls back to theme.sleep */
  sleepColor?: string
}

export function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, days: PosterDay[], o: PosterOptions): void {
  const t = o.theme
  ctx.save()
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'alphabetic'
  ctx.lineCap = 'round'

  const sleepColor = o.sleepColor || t.sleep
  if (o.style === 'rows') drawRows(ctx, w, h, days, o, sleepColor)
  else drawSpiral(ctx, w, h, days, o, sleepColor)

  drawTitle(ctx, w, h, o, days)
  ctx.restore()
}

// ── stacked day-rows ──────────────────────────────────────────────────────────

function drawRows(ctx: CanvasRenderingContext2D, w: number, h: number, days: PosterDay[], o: PosterOptions, sleepColor: string): void {
  const t = o.theme
  const padX = w * 0.11
  const padTop = h * 0.14
  const padBottom = h * 0.06
  const plotW = w - padX - w * 0.05
  const plotH = h - padTop - padBottom
  const x0 = padX
  const n = Math.max(1, days.length)
  const rowH = plotH / n
  const unit = Math.max(w, h) / 1100

  // hour gridlines + labels (0,6,12,18,24), midnight at edges
  ctx.strokeStyle = t.track
  ctx.lineWidth = 1 * unit
  ctx.fillStyle = t.sub
  ctx.font = `${Math.round(11 * unit)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  const hourLabels = ['12a', '6a', '12p', '6p', '12a']
  for (let i = 0; i <= 4; i++) {
    const gx = x0 + (i / 4) * plotW
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(gx, padTop)
    ctx.lineTo(gx, padTop + plotH)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillText(hourLabels[i]!, gx, padTop - 8 * unit)
  }

  // faint 24h track behind every row (the "awake" ground)
  ctx.fillStyle = t.track
  ctx.globalAlpha = 0.55
  ctx.fillRect(x0, padTop, plotW, plotH)
  ctx.globalAlpha = 1

  // sleep blocks
  ctx.fillStyle = sleepColor
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!
    const ry = padTop + i * rowH
    for (const seg of d.sleep) {
      const sx = x0 + seg.s * plotW
      const sw = Math.max(0.4, (seg.e - seg.s) * plotW)
      ctx.fillRect(sx, ry, sw, Math.max(0.6, rowH + 0.4))
    }
  }

  // point events
  const dot = (frac: number, color: string) => {
    ctx.fillStyle = color
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!
      const arr = frac === 0 ? d.feeds : d.diapers
      const ry = padTop + i * rowH + rowH / 2
      const r = Math.min(1.6 * unit, Math.max(0.6, rowH * 0.32))
      for (const f of arr) {
        ctx.beginPath()
        ctx.arc(x0 + f * plotW, ry, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (o.showFeeds) dot(0, t.feed)
  if (o.showDiapers) dot(1, t.diaper)

  // month labels down the left edge
  ctx.fillStyle = t.sub
  ctx.textAlign = 'right'
  ctx.font = `${Math.round(11 * unit)}px system-ui, sans-serif`
  let lastMonth = -1
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!.date
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth()
      const ry = padTop + i * rowH
      const label = d.getMonth() === 0 || i === 0 ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : MONTHS[d.getMonth()]!
      ctx.fillText(label, x0 - 10 * unit, ry + 4 * unit)
      ctx.strokeStyle = t.sub
      ctx.globalAlpha = 0.25
      ctx.lineWidth = 1 * unit
      ctx.beginPath()
      ctx.moveTo(x0 - 6 * unit, ry)
      ctx.lineTo(x0, ry)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  ctx.textAlign = 'left'
}

// ── radial spiral ─────────────────────────────────────────────────────────────

function drawSpiral(ctx: CanvasRenderingContext2D, w: number, h: number, days: PosterDay[], o: PosterOptions, sleepColor: string): void {
  const t = o.theme
  const cx = w / 2
  const cy = h * 0.5 + h * 0.03
  const unit = Math.max(w, h) / 1100
  const rOuter = Math.min(w, h) * 0.42
  const rInner = Math.min(w, h) * 0.08
  const n = Math.max(1, days.length)
  const ring = (rOuter - rInner) / n
  const rAt = (i: number) => rInner + (i / n) * (rOuter - rInner)
  // time-of-day fraction → angle, midnight at top, clockwise
  const ang = (f: number) => -Math.PI / 2 + f * Math.PI * 2

  // faint full rings (awake ground) — draw sparse to avoid mud
  ctx.strokeStyle = t.track
  ctx.lineWidth = Math.max(0.4, ring * 0.9)
  ctx.globalAlpha = 0.5
  const ringStep = Math.max(1, Math.floor(n / 400))
  for (let i = 0; i < n; i += ringStep) {
    ctx.beginPath()
    ctx.arc(cx, cy, rAt(i), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // sleep arcs
  ctx.strokeStyle = sleepColor
  ctx.lineWidth = Math.max(0.6, ring * 1.15)
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!
    const r = rAt(i)
    for (const seg of d.sleep) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, ang(seg.s), ang(seg.e))
      ctx.stroke()
    }
  }

  // point events
  const dots = (getter: (d: PosterDay) => number[], color: string) => {
    ctx.fillStyle = color
    for (let i = 0; i < days.length; i++) {
      const r = rAt(i)
      for (const f of getter(days[i]!)) {
        const a = ang(f)
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(0.5, ring * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (o.showFeeds) dots((d) => d.feeds, t.feed)
  if (o.showDiapers) dots((d) => d.diapers, t.diaper)

  // clock ticks (12a top, 6a right, 12p bottom, 6p left)
  ctx.fillStyle = t.sub
  ctx.font = `${Math.round(12 * unit)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labels: [number, string][] = [[0, '12a'], [0.25, '6a'], [0.5, '12p'], [0.75, '6p']]
  for (const [f, label] of labels) {
    const a = ang(f)
    const rl = rOuter + 22 * unit
    ctx.fillText(label, cx + Math.cos(a) * rl, cy + Math.sin(a) * rl)
  }
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
}

// ── shared title block ────────────────────────────────────────────────────────

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, o: PosterOptions, days: PosterDay[]): void {
  const t = o.theme
  const unit = Math.max(w, h) / 1100
  const padX = w * (o.style === 'rows' ? 0.11 : 0.08)

  ctx.fillStyle = t.fg
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const titleSize = Math.round(h * 0.038)
  ctx.font = `600 ${titleSize}px "Iowan Old Style", Palatino, Georgia, serif`
  ctx.fillText(o.title || 'Sprouts', padX, h * 0.075)

  if (o.subtitle) {
    ctx.fillStyle = t.sub
    const subSize = Math.round(h * 0.02)
    ctx.font = `400 ${subSize}px system-ui, sans-serif`
    ctx.fillText(o.subtitle, padX, h * 0.075 + titleSize * 0.9)
  }

  // legend + count, bottom-right
  ctx.textAlign = 'right'
  const legendY = h * 0.075
  const legSize = Math.round(h * 0.016)
  ctx.font = `500 ${legSize}px system-ui, sans-serif`
  const items: [string, string][] = [['Sleep', o.sleepColor || t.sleep]]
  if (o.showFeeds) items.push(['Feeds', t.feed])
  if (o.showDiapers) items.push(['Diapers', t.diaper])
  let lx = w * (o.style === 'rows' ? 0.95 : 0.92)
  ctx.textBaseline = 'middle'
  for (let i = items.length - 1; i >= 0; i--) {
    const [label, color] = items[i]!
    ctx.fillStyle = t.sub
    ctx.fillText(label, lx, legendY)
    const tw = ctx.measureText(label).width
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(lx - tw - 8 * unit, legendY, 4 * unit, 0, Math.PI * 2)
    ctx.fill()
    lx -= tw + 26 * unit
  }
  ctx.fillStyle = t.sub
  ctx.font = `400 ${Math.round(h * 0.014)}px system-ui, sans-serif`
  ctx.fillText(`${days.length} days`, w * (o.style === 'rows' ? 0.95 : 0.92), legendY + legSize * 1.6)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
}
