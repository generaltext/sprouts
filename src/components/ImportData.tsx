// Import a child's log from JSONL file(s) via the FileAPI — the reliable way to
// bring in bulk/historical data. (Dragging files into the workspace folder on
// desktop ingests their content but doesn't register them as workspace files, so
// they neither show up nor sync; writing through gt does all three.) The picked
// files are read locally; each line is a Sprouts event, appended to the active
// child's log, deduped, and sharded forward under the sync cap.

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useStore } from '~/lib/store'
import { parseAll } from '~/lib/events'

export function ImportData({ onDone }: { onDone?: () => void }) {
  const { activeChild, importEvents } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setStatus('Reading…')
    try {
      const events = []
      for (const file of Array.from(files)) events.push(...parseAll(await file.text()))
      if (events.length === 0) {
        setStatus('No log entries found in that file.')
        return
      }
      setStatus(`Importing ${events.length.toLocaleString()} entries…`)
      const { added, skipped } = await importEvents(events)
      setStatus(added > 0 ? `Imported ${added.toLocaleString()} entries${skipped ? ` (${skipped.toLocaleString()} already present)` : ''}.` : 'Everything in that file was already imported.')
      onDone?.()
    } catch {
      setStatus('Import failed. Make sure the file is a Sprouts .jsonl export.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".jsonl,.json,application/json"
        multiple
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
      <button
        type="button"
        disabled={busy || !activeChild}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-line2 px-3 py-2 text-sm font-medium text-fg2 hover:bg-panel-2 disabled:opacity-40"
      >
        <Upload size={15} />
        {busy ? 'Importing…' : 'Import log (.jsonl)…'}
      </button>
      {status && <p className="mt-1.5 text-xs text-fg3">{status}</p>}
      {activeChild && <p className="mt-1 text-xs text-fg4">Adds to {activeChild.name}'s log. Safe to run more than once.</p>}
    </div>
  )
}
