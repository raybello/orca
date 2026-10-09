import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

const DISMISSED_KEY = 'wf-tips-dismissed'

function getTips(): { title: string; body: string }[] {
  return [
    {
      title: translate('workflows.tips.addNodes.title', 'Adding nodes'),
      body: translate(
        'workflows.tips.addNodes.body',
        'Click the + button at the bottom-center of the canvas to open the node picker. New nodes appear in the visible area.'
      )
    },
    {
      title: translate('workflows.tips.connect.title', 'Connecting nodes'),
      body: translate(
        'workflows.tips.connect.body',
        'Right-click a node to start a connection, then click any other node to link them. Click an edge to delete it.'
      )
    },
    {
      title: translate('workflows.tips.run.title', 'Running a workflow'),
      body: translate(
        'workflows.tips.run.body',
        'Click the ▶ button next to a workflow in the list to run it immediately. Results appear in the Outputs tab below the canvas.'
      )
    }
  ]
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function WorkflowTipsCard(): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(isDismissed)
  const [index, setIndex] = useState(0)

  if (dismissed) {
    return null
  }

  const tips = getTips()
  const tip = tips[index]
  const total = tips.length

  function dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  function prev(): void {
    setIndex((i) => (i - 1 + total) % total)
  }

  function next(): void {
    setIndex((i) => (i + 1) % total)
  }

  return (
    <div className="mx-2 mb-2 mt-1 rounded-md border border-border bg-muted/30 text-[11px]">
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-0">
        <Lightbulb className="size-3 text-muted-foreground shrink-0" />
        <span className="flex-1 font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('workflows.tips.heading', 'Tips')}
        </span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={dismiss}
          aria-label={translate('workflows.tips.dismiss', 'Dismiss tips')}
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="px-2.5 pt-1.5 pb-2">
        <p className="font-medium text-foreground leading-snug mb-0.5">{tip.title}</p>
        <p className="text-muted-foreground leading-relaxed">{tip.body}</p>
      </div>
      <div className="flex items-center justify-between px-2 pb-1.5">
        <div className="flex items-center gap-1">
          {tips.map((t, i) => (
            <button
              key={t.title}
              type="button"
              className={cn(
                'size-1.5 rounded-full transition-colors',
                i === index ? 'bg-foreground/60' : 'bg-foreground/20 hover:bg-foreground/40'
              )}
              onClick={() => setIndex(i)}
              aria-label={translate('workflows.tips.dotLabel', 'Tip {{n}}', { n: i + 1 })}
            />
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            onClick={prev}
            aria-label={translate('workflows.tips.prev', 'Previous tip')}
          >
            <ChevronLeft className="size-3" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            onClick={next}
            aria-label={translate('workflows.tips.next', 'Next tip')}
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
