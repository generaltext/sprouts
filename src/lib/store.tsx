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
import { PATHS, SHARD_TARGET_BYTES, isLogShard, shardIndex, shardPath, type Caregiver, type Child, type Entry } from './types'
import { loadDevSeed, type SeedData } from './seed'
import { demoSeed } from './demo'
import { getUnitPref, setUnitPref, type UnitSystem } from './units'

const ACTIVE_KEY = 'sprouts.activeChild'

/** The sharded log paths for a child, present in the workspace, in shard order. */
function shardPathsFor(childId: string): string[] {
  return window.gt
    .files()
    .filter((p) => isLogShard(p, childId))
    .sort((a, b) => shardIndex(a, childId) - shardIndex(b, childId))
}

/** Which shard a new append should be written to: the newest shard, or a fresh
 *  one when the newest is at/over the size target (keeps every shard under the
 *  E2EE frame cap so it syncs). */
function appendShardFor(childId: string): string {
  const paths = shardPathsFor(childId)
  if (paths.length === 0) return shardPath(childId, 0)
  const latest = paths[paths.length - 1]!
  if (window.gt.subscribeFile(latest).length >= SHARD_TARGET_BYTES) return shardPath(childId, shardIndex(latest, childId) + 1)
  return latest
}

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
  /** Bulk-import already-formed events into the active child's log (migration).
   *  Preserves each event's id/ts/actor, dedupes against what's already there,
   *  and writes forward across shards under the sync cap. Returns counts. */
  importEvents: (events: SproutsEvent[]) => Promise<{ added: number; skipped: number }>
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

  // The active child's log is sharded across several files (see types.ts). We
  // subscribe to every shard, fold the union, and re-fold on any shard change or
  // when the shard set changes (a new shard rolled in, or dropped-in files land).
  const [entries, setEntries] = useState<Entry[]>([])
  useEffect(() => {
    if (!activeChildId) {
      setEntries([])
      return
    }
    const gt = window.gt
    type Sub = { text: ReturnType<typeof gt.subscribeFile>; cb: () => void }
    const subs = new Map<string, Sub>()

    const recompute = () => {
      const all: SproutsEvent[] = []
      for (const p of subs.keys()) all.push(...parseAll(gt.subscribeFile(p).toString()))
      setEntries(foldEntries(all))
    }
    const resync = () => {
      const paths = shardPathsFor(activeChildId)
      for (const p of paths) {
        if (subs.has(p)) continue
        const text = gt.subscribeFile(p)
        const cb = () => recompute()
        text.observe(cb)
        subs.set(p, { text, cb })
      }
      for (const [p, s] of subs) {
        if (paths.includes(p)) continue
        s.text.unobserve(s.cb)
        gt.unsubscribeFile(p)
        subs.delete(p)
      }
      recompute()
    }

    resync()
    const stopFiles = gt.watchFiles(() => resync()) // new shards appearing/leaving
    return () => {
      stopFiles()
      for (const [p, s] of subs) {
        s.text.unobserve(s.cb)
        gt.unsubscribeFile(p)
      }
      subs.clear()
    }
  }, [activeChildId])

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

  // All writes append to the active shard (new entries, edits, and removes alike —
  // the fold merges across shards and last-writer-wins by (ts, id), so an edit or
  // remove appended to the newest shard supersedes the original wherever it lives).
  const logEntry = useCallback<StoreValue['logEntry']>(
    async (data) => {
      if (!activeChildId) throw new Error('no active child')
      const id = newId('ent')
      await append(appendShardFor(activeChildId), [{ type: 'entry.log', subject: id, data }])
      return id
    },
    [append, activeChildId],
  )
  const updateEntry = useCallback<StoreValue['updateEntry']>(
    async (id, data) => {
      if (!activeChildId) return
      await append(appendShardFor(activeChildId), [{ type: 'entry.log', subject: id, data }])
    },
    [append, activeChildId],
  )
  const removeEntry = useCallback<StoreValue['removeEntry']>(
    async (id) => {
      if (!activeChildId) return
      await append(appendShardFor(activeChildId), [{ type: 'entry.remove', subject: id }])
    },
    [append, activeChildId],
  )

  const importEvents = useCallback<StoreValue['importEvents']>(
    async (incoming) => {
      const childId = activeChildId
      if (!childId) throw new Error('no active child')
      const gt = window.gt
      // Dedupe against every event already in this child's shards, so re-importing
      // the same file is a no-op rather than doubling the log.
      const seen = new Set<string>()
      for (const p of shardPathsFor(childId)) for (const ev of parseAll(gt.subscribeFile(p).toString())) seen.add(ev.id)
      const fresh = incoming
        .filter((e) => e && typeof e.id === 'string' && typeof e.type === 'string' && e.type.startsWith('entry.') && !seen.has(e.id))
        .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1)) // oldest first → shard 0 up
      if (fresh.length === 0) return { added: 0, skipped: incoming.length }

      // Write forward across shards, tracking the shard index + size LOCALLY (not
      // via gt.files(), whose file list lags inside a tight write loop and would
      // keep re-picking the same shard → one oversized file). Start at the newest
      // existing shard (append to it) and roll to a fresh numbered shard whenever
      // the target is reached. Each writeFile is one end-insertion under the cap.
      const existing = shardPathsFor(childId)
      const newest = existing[existing.length - 1]
      let shard = newest ? shardIndex(newest, childId) : 0
      let buf = newest ? gt.subscribeFile(newest).toString() : ''
      if (buf.length > 0 && !buf.endsWith('\n')) buf += '\n'

      const run = writeQueue.current.then(async () => {
        for (const ev of fresh) {
          const line = serializeEvent(ev) + '\n'
          if (buf.length > 0 && buf.length + line.length > SHARD_TARGET_BYTES) {
            await gt.writeFile(shardPath(childId, shard), buf)
            shard++
            buf = ''
          }
          buf += line
        }
        if (buf.length > 0) await gt.writeFile(shardPath(childId, shard), buf)
      })
      writeQueue.current = run.catch(() => undefined)
      await run
      return { added: fresh.length, skipped: incoming.length - fresh.length }
    },
    [activeChildId],
  )

  // ── boot: identity, then seed if the workspace is empty ───────────────────────

  useEffect(() => {
    let done = false
    void (async () => {
      await window.gt.ready
      meRef.current = await resolveMe()
      if (done) return

      if (!seeded.current) {
        // `ready` only means the workspace connected; the children file's content
        // arrives after. Wait for it to sync before deciding to seed, or we'd read
        // an empty file and re-seed duplicate children on every open.
        await window.gt.whenFileSynced(PATHS.children)
        if (done) return
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
    // Write each child's log SHARDED under the size target, so the seed mirrors how
    // real data is stored. Sorted oldest-first and filled forward, so shard 0 holds
    // the earliest records and higher shards hold newer ones.
    for (const [cid, evs] of Object.entries(seed.logs)) {
      const sorted = [...evs].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1))
      let shard = 0
      let buf = ''
      const flush = async () => {
        if (!buf) return
        await window.gt.writeFile(shardPath(cid, shard), buf)
        shard++
        buf = ''
      }
      for (const ev of sorted) {
        buf += serializeEvent(ev) + '\n'
        if (buf.length >= SHARD_TARGET_BYTES) await flush()
      }
      await flush()
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
      importEvents,
    }),
    [ready, childList, activeChild, activeChildId, setActiveChild, caregivers, entries, units, setUnits, addChild, updateChild, archiveChild, logEntry, updateEntry, removeEntry, importEvents],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
