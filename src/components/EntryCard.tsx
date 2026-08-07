// One activity row, shared by the timeline and the dashboard's recent list.
// Tapping it opens the editor. Shows the kind (coloured icon), a title + detail,
// the time, an optional note, and who logged it.

import { useState } from 'react'

import { EntryEditor } from '~/components/EntryEditor'
import { KIND_ICON } from '~/components/icons'
import { colorForActor, initialsOf } from '~/lib/caregivers'
import { entryDetail, entryTimeLabel, entryTitle } from '~/lib/format'
import { useStore } from '~/lib/store'
import { kindColor, type Entry } from '~/lib/types'

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
        className="group hover:bg-panel-2 flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors"
      >
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `color-mix(in srgb, ${kindColor(entry.kind)} 16%, transparent)`,
            color: kindColor(entry.kind),
          }}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-fg truncate text-sm font-medium">{entryTitle(entry)}</span>
            {detail && <span className="tnum text-fg3 truncate text-xs">{detail}</span>}
          </span>
          {entry.note && (
            <span className="text-fg3 mt-0.5 block truncate text-xs italic">{entry.note}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="tnum text-fg3 text-xs whitespace-nowrap">{entryTimeLabel(entry)}</span>
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
