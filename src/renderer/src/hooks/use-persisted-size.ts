import { useState, useCallback, useEffect } from 'react'

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

  // Persist to localStorage whenever size changes (not during render)
  useEffect(() => {
    try {
      localStorage.setItem(key, String(size))
    } catch {
      // ignore
    }
  }, [key, size])

  // Functional updater avoids stale closures without capturing size
  const adjust = useCallback(
    (delta: number) => {
      setSize((prev) => Math.min(Math.max(prev + delta, min), max))
    },
    [min, max]
  )

  return [size, adjust]
}
