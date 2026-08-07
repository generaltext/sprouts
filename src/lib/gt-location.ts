// The location bridge for an app whose views live in ordinary React state (no router).
//
// The General Text shell owns the page URL and mirrors what we report into its
// fragment, which is what makes an app's views real destinations: a refresh restores
// the view, any view can be linked, and back/forward step through the app.
//
// Both halves are optional-guarded — `setLocation`/`onLocation` are absent on older
// runtimes, and `setLocation` is a no-op standalone, where the app owns its own URL.
import { useEffect, useRef } from 'react'

/**
 * `path` is the current view serialized as a rooted path. Put DESTINATIONS in the
 * pathname (`/d/abc`) and incidental state in the query (`?q=milk`): a change to the
 * pathname is treated as a real navigation and pushes a history entry, while a
 * query-only change replaces, so typing in a filter box can't flood history.
 *
 * `apply` receives a shell-driven path — the boot deep link, a refresh restoring the
 * fragment, or a back/forward step — and should set state to match. It is handed the
 * app's own path space, exactly as `path` produced it.
 */
export function useGtLocation(path: string, apply: (path: string) => void) {
  const pathRef = useRef(path)
  const applyRef = useRef(apply)
  // Set by the shell→app half so the app→shell half doesn't bounce the same location
  // back as a fresh navigation the shell already knows about.
  const fromShell = useRef<string | null>(null)
  // The first path is the app's own default, and the shell may still be delivering a
  // deep link — announcing the default over it would drop the user's destination.
  const announced = useRef(false)

  useEffect(() => {
    applyRef.current = apply
  }, [apply])

  // Subscribe ONCE: onLocation replays the boot location to every new subscriber, so
  // re-subscribing per render would re-apply a stale deep link over the user's move.
  useEffect(() => {
    const gt = window.gt
    if (!gt?.onLocation) return
    return gt.onLocation((next) => {
      if (next === pathRef.current) return
      fromShell.current = next
      pathRef.current = next
      applyRef.current(next)
    })
  }, [])

  useEffect(() => {
    const prev = pathRef.current
    pathRef.current = path
    const gt = window.gt
    if (!gt?.setLocation) return
    if (fromShell.current === path) {
      fromShell.current = null
      announced.current = true
      return
    }
    if (!announced.current) {
      announced.current = true
      return
    }
    if (path === prev) return
    gt.setLocation(path, { push: path.split('?')[0] !== prev.split('?')[0] })
  }, [path])
}
