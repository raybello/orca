import { useState, useCallback, useRef } from 'react'

export function usePersistedSize(
  key: string,
  defaultVal: number,
  min: number,
  max: number
): [number, (delta: number) => void] {
  const [size, setSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        const n = Number(stored)
        if (Number.isFinite(n)) {
          return Math.min(Math.max(n, min), max)
        }
      }
    } catch {
      // ignore — storage unavailable
    }
    return defaultVal
  })

  // Ref keeps the latest size so adjust doesn't capture a stale value
  const sizeRef = useRef(size)
  sizeRef.current = size

  const adjust = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(sizeRef.current + delta, min), max)
      sizeRef.current = next
      setSize(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {
        // ignore
      }
    },
    [key, min, max]
  )

  return [size, adjust]
}
