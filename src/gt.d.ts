// Ambient types for the platform-injected `window.gt` runtime. General Text
// injects the runtime at serve time (and a dev vite plugin injects it locally),
// so this app bundles NO sync client and no yjs — these are types only.
//
// This is the subset of the contract Sprouts uses. The full surface is documented
// at https://www.generaltext.org/llms.txt (source: building-apps.md).

export interface GtUser {
  id: string
  name: string
  image?: string
}

/** The live CRDT text for a file — methods ride on the object the runtime hands
 *  back; we never construct one, so no yjs import is needed. */
export interface GtText {
  toString(): string
  readonly length: number
  observe(fn: () => void): void
  unobserve(fn: () => void): void
}

export interface GtRuntime {
  readonly ready: Promise<void>
  readonly version: string
  readonly connected: boolean
  /** 'demo' in the gallery "Try it live" demo (and the App Builder preview),
   *  'live' in a normal workspace. */
  readonly mode?: 'demo' | 'live'
  readonly workspaceId?: string

  /** The shell's current light/dark theme (runtime 1.8+). The platform applies
   *  it to <html> automatically and fires `theme-changed` on every toggle.
   *  Absent on older runtimes and standalone. */
  readonly theme?: { mode: 'light' | 'dark'; vars: Record<string, string> }

  user(): Promise<GtUser | null>

  // Reactive reads: subscribe to a file's live text, observe changes.
  subscribeFile(path: string): GtText
  unsubscribeFile(path: string): void

  /** Resolves once a file's initial state has synced from the server (empty for a
   *  genuinely new file). `ready` only means the WORKSPACE connected; per-file
   *  content arrives after. Await this before deciding whether to seed, so you
   *  don't duplicate data whose content simply hasn't arrived yet. */
  whenFileSynced(path: string): Promise<void>

  // Whole-file ops (writeFile diffs internally — merge-friendly).
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<{ path: string; sizeBytes: number }[]>

  files(): string[]
  watchFiles(cb: (paths: string[]) => void): () => void
  on(
    event: 'connected' | 'disconnected' | 'mode-changed' | 'error' | 'theme-changed',
    cb: (...args: unknown[]) => void,
  ): () => void
}

declare global {
  interface Window {
    gt: GtRuntime
    /** Opt-in runtime boot config, set before loading /__gt/runtime.js to force a
     *  local in-browser workspace — used by the standalone demo (see main.tsx). */
    __gtConfig?: { local?: boolean }
    /** Marks the standalone "try the demo" session, so the store seeds sample data. */
    __sproutsDemo?: boolean
  }
}

export {}
