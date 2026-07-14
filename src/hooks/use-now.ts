// A shared ticking clock. Live durations ("nap running 42m") and the "time since
// last…" strip need to re-render on a cadence. One interval, many subscribers.

import { useEffect, useState } from 'react'

/** Current epoch-ms, updated every `everyMs` (default 30s). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
