// The child switcher: the active child's name + age, tapping opens a menu to
// switch between children, add a new one, or edit the active profile.

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { useStore } from '~/lib/store'
import { ageAt } from '~/lib/dates'
import { ColorDot } from '~/components/ui'
import { AddChild } from '~/components/AddChild'
import type { Child } from '~/lib/types'

export function ChildSwitcher() {
  const { children, activeChild, setActiveChild } = useStore()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Child | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!activeChild) return null
  const age = ageAt(activeChild.birthDate)
  const visible = children.filter((c) => !c.archived || c.id === activeChild.id)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-panel-2"
      >
        <ColorDot color={activeChild.color} size={12} />
        <span className="flex flex-col leading-tight">
          <span className="font-serif text-base font-semibold text-fg">{activeChild.name}</span>
          {age && <span className="text-xs text-fg3">{age.label}</span>}
        </span>
        <ChevronDown size={16} className="text-fg3" />
      </button>

      {open && (
        <div className="card card-shadow absolute left-0 top-full z-40 mt-1 w-60 overflow-hidden py-1">
          {visible.map((c) => {
            const a = ageAt(c.birthDate)
            return (
              <div key={c.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveChild(c.id)
                    setOpen(false)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-panel-2"
                >
                  <ColorDot color={c.color} size={11} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                    {a && <span className="block text-xs text-fg3">{a.label}</span>}
                  </span>
                  {c.id === activeChild.id && <Check size={15} className="text-accent" />}
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => {
                    setEditing(c)
                    setOpen(false)
                  }}
                  className="mr-1 rounded-md p-1.5 text-fg4 hover:bg-panel-2 hover:text-fg"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )
          })}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setOpen(false)
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-fg2 hover:bg-panel-2"
          >
            <Plus size={15} /> Add a child
          </button>
        </div>
      )}

      {adding && <AddChild onClose={() => setAdding(false)} />}
      {editing && <AddChild child={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
