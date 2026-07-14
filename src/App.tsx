// App — the shell. A slim top bar (child switcher · view tabs · settings), a
// scrolling content area, and the poster as an overlay. First run with no
// children shows onboarding.

import { useState } from 'react'
import { CalendarDays, Home, Image, LineChart, Loader2, Settings, Sprout } from 'lucide-react'
import { useStore } from '~/lib/store'
import { useTheme } from '~/hooks/use-theme'
import { ChildSwitcher } from '~/components/ChildSwitcher'
import { Dashboard } from '~/components/Dashboard'
import { Timeline } from '~/components/Timeline'
import { Trends } from '~/components/Trends'
import { PosterView } from '~/components/PosterView'
import { AddChild } from '~/components/AddChild'
import { SettingsMenu } from '~/components/SettingsMenu'

type View = 'home' | 'timeline' | 'trends'

const TABS: { view: View; label: string; icon: typeof Home }[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'timeline', label: 'Log', icon: CalendarDays },
  { view: 'trends', label: 'Trends', icon: LineChart },
]

export function App() {
  const { ready, children, activeChild } = useStore()
  useTheme()
  const [view, setView] = useState<View>('home')
  const [poster, setPoster] = useState(false)

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-fg3">
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }

  if (children.length === 0 || !activeChild) return <Onboarding />

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-panel/80 px-3 py-2 backdrop-blur-sm">
        <span className="hidden text-accent sm:inline">
          <Sprout size={20} />
        </span>
        <ChildSwitcher />

        <nav className="ml-auto flex items-center gap-0.5 rounded-lg bg-panel-2 p-0.5">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = view === t.view
            return (
              <button
                key={t.view}
                type="button"
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(t.view)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-2.5 sm:py-1.5 ${active ? 'bg-panel text-fg shadow-sm' : 'text-fg3 hover:text-fg'}`}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </nav>

        <button
          type="button"
          aria-label="Poster"
          onClick={() => setPoster(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 sm:px-2.5 sm:py-1.5"
        >
          <Image size={17} />
          <span className="hidden sm:inline">Poster</span>
        </button>

        <SettingsMenu>
          <button type="button" aria-label="Settings" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg3 hover:bg-panel-2 hover:text-fg">
            <Settings size={18} />
          </button>
        </SettingsMenu>
      </header>

      <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {view === 'home' && <Dashboard />}
        {view === 'timeline' && <Timeline />}
        {view === 'trends' && <Trends />}
      </main>

      {poster && <PosterView onClose={() => setPoster(false)} />}
    </div>
  )
}

function Onboarding() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Sprout size={28} />
        </div>
        <h1 className="font-serif text-2xl font-semibold">Welcome to Sprouts</h1>
        <p className="mt-2 text-sm text-fg2">A calm, private log of your little one's days. Start by adding your child.</p>
        <div className="mt-5 flex justify-center">
          <AddChildInline />
        </div>
      </div>
    </div>
  )
}

function AddChildInline() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:opacity-90">
        <Sprout size={16} /> Add a child
      </button>
      {open && <AddChild onClose={() => setOpen(false)} />}
    </>
  )
}
