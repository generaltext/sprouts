// Reactive reads over window.gt: subscribe to a file's live text and re-render on
// every change (local or remote). Writes go through the store.

import { useEffect, useState } from 'react'

/** Live text of a single file. Re-subscribes when `path` changes. */
export function useGtText(path: string): string {
  const gt = window.gt
  const [text, setText] = useState<string>(() => gt.subscribeFile(path).toString())

  useEffect(() => {
    const t = gt.subscribeFile(path)
    const update = () => setText(t.toString())
    update()
    t.observe(update)
    return () => {
      t.unobserve(update)
      gt.unsubscribeFile(path)
    }
  }, [gt, path])

  return text
}
