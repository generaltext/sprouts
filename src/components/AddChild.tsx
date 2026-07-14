// Add or edit a child. Doubles as the first-run onboarding (when there are no
// children yet) and the "edit profile" sheet.

import { useState } from 'react'
import { useStore, type ChildFields } from '~/lib/store'
import { ENTITY_COLORS, type Child } from '~/lib/types'
import { toDateInput } from '~/lib/dates'
import { Button, ColorDot, Field, Segmented, Sheet, TextInput } from '~/components/ui'

export function AddChild({ child, onClose }: { child?: Child; onClose: () => void }) {
  const { addChild, updateChild, archiveChild, children } = useStore()
  const editing = !!child
  const [name, setName] = useState(child?.name ?? '')
  const [birthDate, setBirthDate] = useState(child ? toDateInput(child.birthDate ? `${child.birthDate}T00:00:00` : '') : '')
  const [sex, setSex] = useState<Child['sex']>(child?.sex ?? 'u')
  const [color, setColor] = useState(child?.color ?? ENTITY_COLORS[children.length % ENTITY_COLORS.length]!)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const fields: ChildFields = { name: name.trim(), birthDate, sex, color }
      if (editing) await updateChild(child!.id, fields)
      else await addChild(fields)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={editing ? 'Edit profile' : 'Add a child'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {editing && children.length > 1 && (
            <Button
              variant="ghost"
              className="text-fg3"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await archiveChild(child!.id, !child!.archived)
                onClose()
              }}
            >
              {child!.archived ? 'Unarchive' : 'Archive'}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Baby's name" />
        </Field>
        <Field label="Birth date" hint="Used for age and growth charts">
          <TextInput type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Sex" hint="For the right growth reference curves">
          <Segmented value={sex} onChange={setSex} options={[{ value: 'f', label: 'Girl' }, { value: 'm', label: 'Boy' }, { value: 'u', label: 'Prefer not' }]} />
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {ENTITY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5"
                style={{ background: c, outline: color === c ? '2px solid var(--color-fg)' : 'none', outlineOffset: 2 }}
              >
                {color === c && <ColorDot color="#fff" size={7} />}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  )
}
