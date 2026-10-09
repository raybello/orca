import { useState, useCallback, useRef, useEffect } from 'react'

export type PanOffset = { x: number; y: number }

function readPan(key: string): PanOffset {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { x: 0, y: 0 }
    }
    // JSON.parse returns any — assign to unknown for safe narrowing without a cast
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: x and y existence confirmed by in-guards; casting only to access their values
      const { x, y } = parsed as { x: unknown; y: unknown }
      if (
        typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y)
      ) {
        return { x, y }
      }
    }
  } catch {
    // ignore — storage unavailable or corrupt
  }
  return { x: 0, y: 0 }
}

export function usePersistedCanvasPan(
  workflowId: string
): [PanOffset, (next: PanOffset) => void, () => void] {
  const [pan, setPanState] = useState<PanOffset>(() => readPan(`wf-canvas-pan-${workflowId}`))
  const panRef = useRef(pan)

  useEffect(() => {
    const loaded = readPan(`wf-canvas-pan-${workflowId}`)
    panRef.current = loaded
    setPanState(loaded)
  }, [workflowId])

  const setPan = useCallback((next: PanOffset) => {
    panRef.current = next
    setPanState(next)
  }, [])

  const persist = useCallback(() => {
    try {
      localStorage.setItem(`wf-canvas-pan-${workflowId}`, JSON.stringify(panRef.current))
    } catch {
      // ignore
    }
  }, [workflowId])

  return [pan, setPan, persist]
}
