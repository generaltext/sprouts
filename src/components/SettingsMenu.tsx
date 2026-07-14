// Settings popover: units and (standalone only) a light/dark toggle. In a real
// General Text install the shell owns the theme, so we don't show a toggle there.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useStore } from '~/lib/store'
import { useTheme } from '~/hooks/use-theme'
import { Segmented } from '~/components/ui'
import { ImportData } from '~/components/ImportData'
import type { UnitSystem } from '~/lib/units'

export function SettingsMenu({ children }: { children: ReactNode }) {
  const { units, setUnits } = useStore()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <span onClick={() => setOpen((v) => !v)}>{children}</span>
      {open && (
        <div className="card card-shadow absolute right-0 top-full z-40 mt-1 w-64 space-y-4 p-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg3">Units</div>
            <Segmented<UnitSystem>
              value={units}
              onChange={setUnits}
              options={[
                { value: 'imperial', label: 'oz · lb · in' },
                { value: 'metric', label: 'ml · kg · cm' },
              ]}
            />
          </div>

          {theme.canToggle && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg3">Theme</div>
              <button
                type="button"
                onClick={theme.toggle}
                className="inline-flex items-center gap-2 rounded-lg border border-line2 px-3 py-2 text-sm text-fg2 hover:bg-panel-2"
              >
                {theme.dark ? <Moon size={15} /> : <Sun size={15} />}
                {theme.dark ? 'Dark' : 'Light'}
              </button>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg3">Import</div>
            <ImportData onDone={() => setOpen(false)} />
          </div>

          <p className="border-t border-line pt-3 text-xs leading-relaxed text-fg4">
            Your data lives as plain files in your workspace. No predictions, no ads, no account.
          </p>
        </div>
      )}
    </div>
  )
}
