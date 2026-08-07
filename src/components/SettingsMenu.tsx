// Settings popover: units and (standalone only) a light/dark toggle. In a real
// General Text install the shell owns the theme, so we don't show a toggle there.

import { Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { ImportData } from '~/components/ImportData'
import { Segmented } from '~/components/ui'
import { useTheme } from '~/hooks/use-theme'
import { useStore } from '~/lib/store'
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
        <div className="card card-shadow absolute top-full right-0 z-40 mt-1 w-64 space-y-4 p-4">
          <div>
            <div className="text-fg3 mb-1.5 text-xs font-semibold tracking-wide uppercase">
              Units
            </div>
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
              <div className="text-fg3 mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Theme
              </div>
              <button
                type="button"
                onClick={theme.toggle}
                className="border-line2 text-fg2 hover:bg-panel-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                {theme.dark ? <Moon size={15} /> : <Sun size={15} />}
                {theme.dark ? 'Dark' : 'Light'}
              </button>
            </div>
          )}

          <div className="border-line border-t pt-3">
            <div className="text-fg3 mb-1.5 text-xs font-semibold tracking-wide uppercase">
              Import
            </div>
            <ImportData onDone={() => setOpen(false)} />
          </div>

          <p className="border-line text-fg4 border-t pt-3 text-xs leading-relaxed">
            Your data lives as plain files in your workspace. No predictions, no ads, no account.
          </p>
        </div>
      )}
    </div>
  )
}
