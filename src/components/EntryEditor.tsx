// Create or edit one activity. One form, kind-specific fields. Produces the
// kind's `data` payload and calls the store (new → logEntry, edit → updateEntry).
// Times are entered in local wall-clock and stored as ISO instants.

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { fromLocalInput, nowLocalInput, toLocalInput } from '~/lib/dates'
import { cmToIn, gToLbOz, inToCm, lbOzToG, mlToDisplay, volumeToMl, volumeUnitLabel, lengthUnitLabel } from '~/lib/units'
import { KIND_LABEL, isRanged, type BottleContents, type Entry, type EntryKind, type Side } from '~/lib/types'
import { Button, Field, Segmented, Sheet, TextInput } from '~/components/ui'
import { KIND_ICON } from '~/components/icons'

const num = (s: string): number | undefined => {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined
}

export function EntryEditor({ kind, entry, onClose }: { kind: EntryKind; entry?: Entry; onClose: () => void }) {
  const { units, logEntry, updateEntry, removeEntry } = useStore()
  const editing = !!entry
  const Icon = KIND_ICON[kind]

  const init = useMemo(() => buildInitial(kind, entry, units), [kind, entry, units])
  const [f, setF] = useState(init)
  const set = <K extends keyof typeof init>(k: K, v: (typeof init)[K]) => setF((prev) => ({ ...prev, [k]: v }))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const data = buildData(kind, f, units)
      if (editing) await updateEntry(entry!.id, data)
      else await logEntry(data)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!entry) return
    setBusy(true)
    try {
      await removeEntry(entry.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const ranged = isRanged(kind)
  const volUnit = volumeUnitLabel(units)
  const lenUnit = lengthUnitLabel(units)

  return (
    <Sheet
      title={`${editing ? 'Edit' : 'Log'} ${KIND_LABEL[kind].toLowerCase()}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="ghost" onClick={del} disabled={busy} className="text-bad">
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {editing ? 'Save' : 'Log it'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-fg2">
        <span style={{ color: `var(--color-${kind.startsWith('feed') ? kind.split('.')[1] === 'bottle' ? 'feed' : kind.split('.')[1] : kind})` }}>
          <Icon size={18} />
        </span>
        <span className="text-sm font-medium">{KIND_LABEL[kind]}</span>
      </div>

      <div className="space-y-4">
        {/* time */}
        <Field label={ranged || kind === 'sleep' ? 'Start' : 'Time'}>
          <TextInput type="datetime-local" value={f.start} onChange={(e) => set('start', e.target.value)} />
        </Field>

        {(ranged || kind === 'sleep') && (
          <Field label="End" hint={f.running ? 'Timer running; leave to keep timing' : undefined}>
            <div className="flex items-center gap-2">
              <TextInput type="datetime-local" value={f.end} disabled={f.running} onChange={(e) => set('end', e.target.value)} className={f.running ? 'opacity-50' : ''} />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-fg3">
                <input type="checkbox" checked={f.running} onChange={(e) => set('running', e.target.checked)} className="accent-[var(--color-accent)]" />
                running
              </label>
            </div>
          </Field>
        )}

        {/* kind-specific */}
        {kind === 'feed.bottle' && (
          <>
            <Field label={`Volume (${volUnit})`}>
              <TextInput type="number" inputMode="decimal" value={f.volume} onChange={(e) => set('volume', e.target.value)} placeholder="e.g. 4" />
            </Field>
            <Field label="Contents">
              <Segmented<BottleContents>
                value={f.contents}
                onChange={(v) => set('contents', v)}
                options={[
                  { value: 'breastmilk', label: 'Breast milk' },
                  { value: 'formula', label: 'Formula' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
              />
            </Field>
          </>
        )}

        {kind === 'feed.breast' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Left (min)">
                <TextInput type="number" inputMode="decimal" value={f.leftMin} onChange={(e) => set('leftMin', e.target.value)} />
              </Field>
              <Field label="Right (min)">
                <TextInput type="number" inputMode="decimal" value={f.rightMin} onChange={(e) => set('rightMin', e.target.value)} />
              </Field>
            </div>
            <Field label="Last side" hint="So you know where to start next time">
              <Segmented<Side> value={f.lastSide} onChange={(v) => set('lastSide', v)} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
            </Field>
          </>
        )}

        {kind === 'feed.pump' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Left (${volUnit})`}>
              <TextInput type="number" inputMode="decimal" value={f.leftVol} onChange={(e) => set('leftVol', e.target.value)} />
            </Field>
            <Field label={`Right (${volUnit})`}>
              <TextInput type="number" inputMode="decimal" value={f.rightVol} onChange={(e) => set('rightVol', e.target.value)} />
            </Field>
          </div>
        )}

        {kind === 'feed.solid' && (
          <Field label="Food">
            <TextInput value={f.food} onChange={(e) => set('food', e.target.value)} placeholder="e.g. mashed banana" />
          </Field>
        )}

        {kind === 'diaper' && (
          <>
            <div className="flex gap-2">
              <Toggle label="Wet" on={f.wet} onClick={() => set('wet', !f.wet)} />
              <Toggle label="Dirty" on={f.dirty} onClick={() => set('dirty', !f.dirty)} />
              <Toggle label="Blowout" on={f.blowout} onClick={() => set('blowout', !f.blowout)} />
            </div>
            {f.dirty && (
              <Field label="Colour (optional)">
                <TextInput value={f.stoolColor} onChange={(e) => set('stoolColor', e.target.value)} placeholder="e.g. yellow, green" />
              </Field>
            )}
          </>
        )}

        {kind === 'growth' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label={units === 'metric' ? 'Weight (kg)' : 'Weight (lb)'}>
              <TextInput type="number" inputMode="decimal" value={f.weight} onChange={(e) => set('weight', e.target.value)} />
            </Field>
            <Field label={`Height (${lenUnit})`}>
              <TextInput type="number" inputMode="decimal" value={f.height} onChange={(e) => set('height', e.target.value)} />
            </Field>
            <Field label={`Head (${lenUnit})`}>
              <TextInput type="number" inputMode="decimal" value={f.head} onChange={(e) => set('head', e.target.value)} />
            </Field>
          </div>
        )}

        {kind === 'tummy' && (
          <Field label="Label">
            <TextInput value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="Tummy time" />
          </Field>
        )}

        {kind === 'medicine' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <TextInput value={f.medName} onChange={(e) => set('medName', e.target.value)} placeholder="e.g. Vitamin D" />
            </Field>
            <Field label="Dose (optional)">
              <TextInput value={f.dose} onChange={(e) => set('dose', e.target.value)} placeholder="e.g. 400 IU" />
            </Field>
          </div>
        )}

        {kind === 'milestone' && (
          <Field label="Milestone">
            <TextInput value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. First smile" />
          </Field>
        )}

        <Field label="Note">
          <textarea
            value={f.note}
            onChange={(e) => set('note', e.target.value)}
            rows={kind === 'note' ? 4 : 2}
            placeholder={kind === 'note' ? 'What happened…' : 'Optional'}
            className="w-full resize-none rounded-lg border border-line2 bg-panel px-3 py-2 text-sm text-fg outline-none placeholder:text-fg4 focus:border-accent"
          />
        </Field>
      </div>
    </Sheet>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
        on ? 'border-accent bg-accent-soft text-fg' : 'border-line2 text-fg3 hover:bg-panel-2'
      }`}
    >
      {label}
    </button>
  )
}

// ── form state ⇄ entry data ───────────────────────────────────────────────────

type FormState = ReturnType<typeof buildInitial>

function buildInitial(kind: EntryKind, entry: Entry | undefined, units: 'imperial' | 'metric') {
  const e = entry
  const startIso = e?.start ?? new Date().toISOString()
  const secToMin = (s?: number) => (s ? String(Math.round((s / 60) * 10) / 10) : '')
  const weightStr = e?.weightG ? (units === 'metric' ? String(Math.round((e.weightG / 1000) * 100) / 100) : lbFromG(e.weightG)) : ''
  const lenStr = (cm?: number) => (cm ? String(units === 'metric' ? Math.round(cm * 10) / 10 : Math.round(cmToIn(cm) * 10) / 10) : '')
  return {
    start: toLocalInput(startIso),
    end: e?.end ? toLocalInput(e.end) : e ? '' : nowLocalInput(),
    running: e ? e.end === null : false,
    note: e?.note ?? '',
    volume: e?.volumeMl != null ? String(mlToDisplay(e.volumeMl, units)) : '',
    contents: (e?.contents ?? 'breastmilk') as BottleContents,
    leftMin: secToMin(e?.leftSec),
    rightMin: secToMin(e?.rightSec),
    lastSide: (e?.lastSide ?? 'left') as Side,
    leftVol: e?.leftMl != null ? String(mlToDisplay(e.leftMl, units)) : '',
    rightVol: e?.rightMl != null ? String(mlToDisplay(e.rightMl, units)) : '',
    food: e?.food ?? '',
    wet: e?.wet ?? (kind === 'diaper' ? true : false),
    dirty: e?.dirty ?? false,
    blowout: e?.blowout ?? false,
    stoolColor: e?.stoolColor ?? '',
    weight: weightStr,
    height: lenStr(e?.heightCm),
    head: lenStr(e?.headCm),
    label: e?.label ?? '',
    medName: e?.medName ?? '',
    dose: e?.dose ?? '',
  }
}

function lbFromG(g: number): string {
  const { lb, oz } = gToLbOz(g)
  // Represent as decimal lb for a single input (e.g. 13.25). Round to 2 dp.
  return String(Math.round((lb + oz / 16) * 100) / 100)
}

function buildData(kind: EntryKind, f: FormState, units: 'imperial' | 'metric'): Record<string, unknown> {
  const start = fromLocalInput(f.start) || new Date().toISOString()
  const data: Record<string, unknown> = { kind, start }
  if (f.note.trim()) data.note = f.note.trim()

  const setEnd = () => {
    if (f.running) data.end = null
    else if (f.end) data.end = fromLocalInput(f.end)
  }

  switch (kind) {
    case 'sleep':
      setEnd()
      break
    case 'feed.bottle': {
      const v = num(f.volume)
      if (v != null) data.volumeMl = Math.round(volumeToMl(v, units))
      data.contents = f.contents
      break
    }
    case 'feed.breast': {
      const l = num(f.leftMin)
      const r = num(f.rightMin)
      if (l != null) data.leftSec = Math.round(l * 60)
      if (r != null) data.rightSec = Math.round(r * 60)
      data.lastSide = f.lastSide
      if (f.running) data.end = null
      else if ((l ?? 0) + (r ?? 0) > 0) data.end = new Date(new Date(start).getTime() + ((l ?? 0) + (r ?? 0)) * 60_000).toISOString()
      break
    }
    case 'feed.pump': {
      const l = num(f.leftVol)
      const r = num(f.rightVol)
      if (l != null) data.leftMl = Math.round(volumeToMl(l, units))
      if (r != null) data.rightMl = Math.round(volumeToMl(r, units))
      setEnd()
      break
    }
    case 'feed.solid':
      if (f.food.trim()) data.food = f.food.trim()
      break
    case 'diaper':
      data.wet = f.wet
      data.dirty = f.dirty
      if (f.blowout) data.blowout = true
      if (f.dirty && f.stoolColor.trim()) data.stoolColor = f.stoolColor.trim().toLowerCase()
      break
    case 'growth': {
      const w = num(f.weight)
      const h = num(f.height)
      const hc = num(f.head)
      if (w != null) data.weightG = Math.round(units === 'metric' ? w * 1000 : lbToG(w))
      if (h != null) data.heightCm = Math.round((units === 'metric' ? h : inToCm(h)) * 10) / 10
      if (hc != null) data.headCm = Math.round((units === 'metric' ? hc : inToCm(hc)) * 10) / 10
      break
    }
    case 'tummy':
      data.label = f.label.trim() || 'Tummy time'
      setEnd()
      break
    case 'medicine':
      if (f.medName.trim()) data.medName = f.medName.trim()
      if (f.dose.trim()) data.dose = f.dose.trim()
      break
    case 'milestone':
      data.label = f.label.trim() || 'Milestone'
      break
    case 'note':
      // note already set; ensure it exists
      if (!data.note) data.note = f.note.trim()
      break
  }
  return data
}

function lbToG(lb: number): number {
  return lbOzToG(lb, 0)
}
