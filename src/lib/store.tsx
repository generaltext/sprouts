// The store: live subscriptions to children.jsonl and the active child's log,
// folded into records, plus the dispatch that stamps and appends new events.
// Appends read the freshest file content and add to the end, so the runtime
// diffs each write to a pure end-insertion — concurrent appends from two phones
// both survive. Children are multi: a switcher picks the active one, whose log
// file drives the dashboard / timeline / summaries / poster.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGtText } from '~/hooks/use-gt-files'
import { type Actor, type Draft, type SproutsEvent, parseAll, serializeEvent } from './events'
import { foldChildren, foldEntries } from './reducer'
import { deriveCaregivers } from './caregivers'
import { newId, ulid } from './ids'
import { PATHS, type Caregiver, type Child, type Entry } from './types'
import { loadDevSeed, type SeedData } from './seed'
import { demoSeed } from './demo'
import { getUnitPref, setUnitPref, type UnitSystem } from './units'

const ACTIVE_KEY = 'sprouts.activeChild'
const NO_CHILD = 'v0/logs/__none__.jsonl'

export interface ChildFields {
  name: string
  birthDate: string
  sex: Child['sex']
  color: string
}

interface StoreValue {
  ready: boolean
  me: Actor | null
  children: Child[]
  activeChild: Child | null
  activeChildId: string | null
  setActiveChild: (id: string) => void
  caregivers: Caregiver[]
  entries: Entry[]
  units: UnitSystem
  setUnits: (u: UnitSystem) => void
  addChild: (fields: ChildFields) => Promise<string>
  updateChild: (id: string, patch: Partial<ChildFields>) => Promise<void>
  archiveChild: (id: string, archived: boolean) => Promise<void>
  /** Append a brand-new entry; returns its id. `data` is the kind-specific payload. */
  logEntry: (data: Record<string, unknown>) => Promise<string>
  /** Re-log an existing entry with a full new payload (edit). */
  updateEntry: (id: string, data: Record<string, unknown>) => Promise<void>
  removeEntry: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function isDemoSession(): boolean {
  return window.gt.mode === 'demo' || window.__sproutsDemo === true
}

async function resolveMe(): Promise<Actor> {
  try {
    const u = await window.gt.user()
    if (u) return { id: u.id, name: u.name }
  } catch {
    /* fall through to a local identity */
  }
  let id = localStorage.getItem('sprouts.actor.id')
  if (!id) {
    id = `local_${ulid()}`
    localStorage.setItem('sprouts.actor.id', id)
  }
  return { id, name: localStorage.getItem('sprouts.actor.name') || 'You' }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [units, setUnitsState] = useState<UnitSystem>(() => getUnitPref())
  const [activeChildId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))

  const meRef = useRef<Actor | null>(null)
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve())
  const seeded = useRef(false)

  // Live folds.
  const childrenText = useGtText(PATHS.children)
  const childrenState = useMemo(() => foldChildren(parseAll(childrenText)), [childrenText])
  const childList = useMemo(
    () => childrenState.order.map((id) => childrenState.byId[id]).filter((c): c is Child => !!c),
    [childrenState],
  )

  const logPath = activeChildId ? PATHS.log(activeChildId) : NO_CHILD
  const logText = useGtText(logPath)
  const entries = useMemo(() => (activeChildId ? foldEntries(parseAll(logText)) : []), [logText, activeChildId])
  const caregivers = useMemo(() => deriveCaregivers(entries, meRef.current), [entries, ready])

  // ── writes ──────────────────────────────────────────────────────────────────

  const append = useCallback(async (path: string, drafts: Draft[]): Promise<void> => {
    if (drafts.length === 0) return
    const now = new Date().toISOString()
    const events: SproutsEvent[] = drafts.map((d) => ({
      id: newId('evt'),
      ts: now,
      actor: meRef.current,
      type: d.type,
      subject: d.subject,
      ...(d.data ? { data: d.data } : {}),
    }))
    const run = writeQueue.current.then(async () => {
      const base = window.gt.subscribeFile(path).toString()
      const prefix = base.length === 0 || base.endsWith('\n') ? base : base + '\n'
      const body = events.map(serializeEvent).join('\n')
      await window.gt.writeFile(path, prefix + body + '\n')
    })
    writeQueue.current = run.catch(() => undefined)
    await run
  }, [])

  const setActiveChild = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }, [])

  const setUnits = useCallback((u: UnitSystem) => {
    setUnitPref(u)
    setUnitsState(u)
  }, [])

  const addChild = useCallback<StoreValue['addChild']>(
    async (fields) => {
      const id = newId('chi')
      await append(PATHS.children, [{ type: 'child.create', subject: id, data: { ...fields } }])
      setActiveChild(id)
      return id
    },
    [append, setActiveChild],
  )
  const updateChild = useCallback<StoreValue['updateChild']>(
    async (id, patch) => append(PATHS.children, [{ type: 'child.update', subject: id, data: { ...patch } }]),
    [append],
  )
  const archiveChild = useCallback<StoreValue['archiveChild']>(
    async (id, archived) => append(PATHS.children, [{ type: 'child.archive', subject: id, data: { archived } }]),
    [append],
  )

  const logEntry = useCallback<StoreValue['logEntry']>(
    async (data) => {
      if (!activeChildId) throw new Error('no active child')
      const id = newId('ent')
      await append(PATHS.log(activeChildId), [{ type: 'entry.log', subject: id, data }])
      return id
    },
    [append, activeChildId],
  )
  const updateEntry = useCallback<StoreValue['updateEntry']>(
    async (id, data) => {
      if (!activeChildId) return
      await append(PATHS.log(activeChildId), [{ type: 'entry.log', subject: id, data }])
    },
    [append, activeChildId],
  )
  const removeEntry = useCallback<StoreValue['removeEntry']>(
    async (id) => {
      if (!activeChildId) return
      await append(PATHS.log(activeChildId), [{ type: 'entry.remove', subject: id }])
    },
    [append, activeChildId],
  )

  // ── boot: identity, then seed if the workspace is empty ───────────────────────

  useEffect(() => {
    let done = false
    void (async () => {
      await window.gt.ready
      meRef.current = await resolveMe()
      if (done) return

      if (!seeded.current) {
        const hasChildren = parseAll(window.gt.subscribeFile(PATHS.children).toString()).some((e) => e.type === 'child.create')
        if (!hasChildren) {
          seeded.current = true
          const seed: SeedData | null = isDemoSession() ? demoSeed() : loadDevSeed()
          if (seed) await writeSeed(seed)
        }
      }
      if (done) return
      setReady(true)
    })()
    return () => {
      done = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function writeSeed(seed: SeedData): Promise<void> {
    await window.gt.writeFile(PATHS.children, seed.children.map(serializeEvent).join('\n') + '\n')
    for (const [cid, evs] of Object.entries(seed.logs)) {
      await window.gt.writeFile(PATHS.log(cid), evs.map(serializeEvent).join('\n') + '\n')
    }
    const first = seed.children.find((e) => e.type === 'child.create')
    if (first) setActiveChild(first.subject)
  }

  // Keep the active child valid: default to the first non-archived, drop if gone.
  useEffect(() => {
    if (childList.length === 0) return
    const live = childList.filter((c) => !c.archived)
    const pool = live.length ? live : childList
    if (!activeChildId || !childList.some((c) => c.id === activeChildId)) {
      setActiveChild(pool[0]!.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childList, activeChildId])

  const activeChild = useMemo(
    () => childList.find((c) => c.id === activeChildId) ?? null,
    [childList, activeChildId],
  )

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      me: meRef.current,
      children: childList,
      activeChild,
      activeChildId,
      setActiveChild,
      caregivers,
      entries,
      units,
      setUnits,
      addChild,
      updateChild,
      archiveChild,
      logEntry,
      updateEntry,
      removeEntry,
    }),
    [ready, childList, activeChild, activeChildId, setActiveChild, caregivers, entries, units, setUnits, addChild, updateChild, archiveChild, logEntry, updateEntry, removeEntry],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
