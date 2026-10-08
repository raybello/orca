import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'

type Props = {
  value: string
  onChange: (v: string) => void
}

const CRON_VALUES = {
  everyMinute: '* * * * *',
  every5m: '*/5 * * * *',
  every15m: '*/15 * * * *',
  every30m: '*/30 * * * *',
  everyHour: '0 * * * *',
  every2h: '0 */2 * * *',
  every6h: '0 */6 * * *',
  dailyMidnight: '0 0 * * *',
  daily6am: '0 6 * * *',
  daily8am: '0 8 * * *',
  dailyNoon: '0 12 * * *',
  weekdays9am: '0 9 * * 1-5',
  weeklyMon8am: '0 8 * * 1',
  monthly1st: '0 0 1 * *'
}

function getTemplates(): { label: string; value: string }[] {
  return [
    {
      label: translate('workflows.cron.everyMinute', 'Every minute'),
      value: CRON_VALUES.everyMinute
    },
    { label: translate('workflows.cron.every5m', 'Every 5 minutes'), value: CRON_VALUES.every5m },
    {
      label: translate('workflows.cron.every15m', 'Every 15 minutes'),
      value: CRON_VALUES.every15m
    },
    {
      label: translate('workflows.cron.every30m', 'Every 30 minutes'),
      value: CRON_VALUES.every30m
    },
    { label: translate('workflows.cron.everyHour', 'Every hour'), value: CRON_VALUES.everyHour },
    { label: translate('workflows.cron.every2h', 'Every 2 hours'), value: CRON_VALUES.every2h },
    { label: translate('workflows.cron.every6h', 'Every 6 hours'), value: CRON_VALUES.every6h },
    {
      label: translate('workflows.cron.dailyMidnight', 'Daily at midnight'),
      value: CRON_VALUES.dailyMidnight
    },
    { label: translate('workflows.cron.daily6am', 'Daily at 6 AM'), value: CRON_VALUES.daily6am },
    { label: translate('workflows.cron.daily8am', 'Daily at 8 AM'), value: CRON_VALUES.daily8am },
    { label: translate('workflows.cron.dailyNoon', 'Daily at noon'), value: CRON_VALUES.dailyNoon },
    {
      label: translate('workflows.cron.weekdays9am', 'Weekdays at 9 AM (Mon–Fri)'),
      value: CRON_VALUES.weekdays9am
    },
    {
      label: translate('workflows.cron.weeklyMon8am', 'Weekly — Monday at 8 AM'),
      value: CRON_VALUES.weeklyMon8am
    },
    {
      label: translate('workflows.cron.monthly1st', 'Monthly — 1st at midnight'),
      value: CRON_VALUES.monthly1st
    }
  ]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:00 ${ampm}`
}

function describeCron(expr: string): string | null {
  const match = getTemplates().find((t) => t.value === expr)
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
  const templates = getTemplates()
  const [showCustom, setShowCustom] = useState(
    value !== '' && !templates.some((t) => t.value === value)
  )

  const matchedTemplate = templates.find((t) => t.value === value)?.value ?? '__custom__'
  const description = describeCron(value)

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {translate('workflows.cron.schedule', 'Schedule')}
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
          <SelectValue
            placeholder={translate('workflows.cron.choosePlaceholder', 'Choose a template…')}
          />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">
            {translate('workflows.cron.customExpression', 'Custom expression…')}
          </SelectItem>
        </SelectContent>
      </Select>
      {(showCustom || !templates.some((t) => t.value === value)) && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={translate(
            'workflows.cron.cronPlaceholder',
            '* * * * *  (min hour dom month dow)'
          )}
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
