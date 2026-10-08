import { useRef } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  direction: 'horizontal' | 'vertical'
  onDelta: (delta: number) => void
}

export default function PanelDivider({ direction, onDelta }: Props): React.JSX.Element {
  const dragRef = useRef<{ start: number } | null>(null)

  function handleMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    dragRef.current = { start: direction === 'horizontal' ? e.clientX : e.clientY }

    const onMouseMove = (ev: MouseEvent): void => {
      if (!dragRef.current) {
        return
      }
      const curr = direction === 'horizontal' ? ev.clientX : ev.clientY
      const delta = curr - dragRef.current.start
      dragRef.current.start = curr
      onDelta(delta)
    }
    const onMouseUp = (): void => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      className={cn(
        'shrink-0 bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors z-10',
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      )}
      onMouseDown={handleMouseDown}
    />
  )
}
