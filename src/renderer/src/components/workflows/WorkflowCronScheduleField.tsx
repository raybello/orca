import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type Props = {
  value: string
  onChange: (v: string) => void
}

const TEMPLATES: { label: string; value: string }[] = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at 8 AM', value: '0 8 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekdays at 9 AM (Mon–Fri)', value: '0 9 * * 1-5' },
  { label: 'Weekly — Monday at 8 AM', value: '0 8 * * 1' },
  { label: 'Monthly — 1st at midnight', value: '0 0 1 * *' }
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:00 ${ampm}`
}

function describeCron(expr: string): string | null {
  const match = TEMPLATES.find((t) => t.value === expr)
  if (match) {
    return match.label
  }

  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    return null
  }
  const [min, hour, dom, , dow] = parts

  if (min === '*' && hour === '*' && dom === '*' && dow === '*') {
    return 'Every minute'
  }

  const stepMin = min.match(/^\*\/(\d+)$/)
  if (stepMin && hour === '*' && dom === '*' && dow === '*') {
    return `Every ${stepMin[1]} minutes`
  }

  const stepHr = hour.match(/^\*\/(\d+)$/)
  if (min === '0' && stepHr && dom === '*' && dow === '*') {
    return `Every ${stepHr[1]} hours`
  }

  if (hour === '*' && dom === '*' && dow === '*') {
    return min === '0' ? 'Every hour' : `Every hour at :${min.padStart(2, '0')}`
  }

  const isWildHour = hour === '*'
  const fixedHour = !isWildHour && /^\d+$/.test(hour)
  const fixedMin = /^\d+$/.test(min)

  let timePart = ''
  if (fixedHour && fixedMin) {
    timePart = ` at ${fmtHour(Number.parseInt(hour, 10))}`
  }

  if (dom !== '*' && dom === '1' && dow === '*') {
    return `Monthly (1st)${timePart}`
  }

  if (dow !== '*') {
    const rangeParts = dow.match(/^(\d)-(\d)$/)
    if (rangeParts) {
      const from = Number.parseInt(rangeParts[1], 10)
      const to = Number.parseInt(rangeParts[2], 10)
      const label =
        from === 1 && to === 5 ? 'Weekdays (Mon–Fri)' : `${DAYS[from] ?? from}–${DAYS[to] ?? to}`
      return `${label}${timePart}`
    }
    const singleDay = /^\d$/.test(dow)
    if (singleDay) {
      return `Weekly — ${DAYS[Number.parseInt(dow, 10)] ?? `day ${dow}`}${timePart}`
    }
  }

  if (dom === '*' && dow === '*') {
    return `Daily${timePart}`
  }

  return null
}

export default function WorkflowCronScheduleField({ value, onChange }: Props): React.JSX.Element {
  const [showCustom, setShowCustom] = useState(
    value !== '' && !TEMPLATES.some((t) => t.value === value)
  )

  const matchedTemplate = TEMPLATES.find((t) => t.value === value)?.value ?? '__custom__'
  const description = describeCron(value)

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Schedule
      </span>
      <Select
        value={showCustom ? '__custom__' : matchedTemplate}
        onValueChange={(v) => {
          if (v === '__custom__') {
            setShowCustom(true)
          } else {
            setShowCustom(false)
            onChange(v)
          }
        }}
      >
        <SelectTrigger className="h-7">
          <SelectValue placeholder="Choose a template…" />
        </SelectTrigger>
        <SelectContent>
          {TEMPLATES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom expression…</SelectItem>
        </SelectContent>
      </Select>
      {(showCustom || !TEMPLATES.some((t) => t.value === value)) && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="* * * * *  (min hour dom month dow)"
          className="h-7"
          variant="mono"
          spellCheck={false}
          autoFocus={showCustom}
        />
      )}
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  )
}
