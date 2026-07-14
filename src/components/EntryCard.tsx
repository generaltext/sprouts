// One activity row, shared by the timeline and the dashboard's recent list.
// Tapping it opens the editor. Shows the kind (coloured icon), a title + detail,
// the time, an optional note, and who logged it.

import { useState } from 'react'
import { useStore } from '~/lib/store'
import { entryDetail, entryTimeLabel, entryTitle } from '~/lib/format'
import { kindColor, type Entry } from '~/lib/types'
import { colorForActor, initialsOf } from '~/lib/caregivers'
import { KIND_ICON } from '~/components/icons'
import { EntryEditor } from '~/components/EntryEditor'

export function EntryCard({ entry, showActor = true }: { entry: Entry; showActor?: boolean }) {
  const { units } = useStore()
  const [editing, setEditing] = useState(false)
  const Icon = KIND_ICON[entry.kind]
  const detail = entryDetail(entry, units)

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-panel-2"
      >
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${kindColor(entry.kind)} 16%, transparent)`, color: kindColor(entry.kind) }}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-fg">{entryTitle(entry)}</span>
            {detail && <span className="tnum truncate text-xs text-fg3">{detail}</span>}
          </span>
          {entry.note && <span className="mt-0.5 block truncate text-xs italic text-fg3">{entry.note}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="tnum whitespace-nowrap text-xs text-fg3">{entryTimeLabel(entry)}</span>
          {showActor && entry.actor && (
            <span
              className="flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold text-white"
              style={{ background: colorForActor(entry.actor.id) }}
              title={entry.actor.name}
            >
              {initialsOf(entry.actor.name)}
            </span>
          )}
        </span>
      </button>
      {editing && <EntryEditor kind={entry.kind} entry={entry} onClose={() => setEditing(false)} />}
    </>
  )
}
