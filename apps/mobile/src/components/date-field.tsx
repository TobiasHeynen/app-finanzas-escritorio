import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarDays } from 'lucide-react-native'
import {
  addMonths,
  daysInMonth,
  formatDateShort,
  formatDayHeading,
  monthOf,
  parseDate,
  parseMonth,
  toDate,
  todayIso,
  type Month,
} from '@shared/months'
import { MonthStepper } from './month-stepper'
import { Button } from './ui'
import { radius, space, useColors } from '@/lib/theme'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Campo de fecha ('YYYY-MM-DD') con un calendario propio: sin dependencias nativas extra. */
export function DateField({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (date: string) => void
  invalid?: boolean
}) {
  const c = useColors()
  const [open, setOpen] = useState(false)
  const today = todayIso()
  const yesterday = (() => {
    const { year, month, day } = parseDate(today)
    if (day > 1) return toDate(year, month, day - 1)
    const prev = addMonths(monthOf(today), -1)
    const p = parseMonth(prev)
    return toDate(p.year, p.month, daysInMonth(prev))
  })()
  const label =
    value === today ? 'Hoy' : value === yesterday ? 'Ayer' : capitalize(formatDayHeading(value))

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fecha: ${formatDateShort(value)}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: invalid ? c.negative : c.border,
            backgroundColor: c.card,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <CalendarDays color={c.mutedForeground} size={18} />
        <Text style={{ color: c.foreground, fontSize: 16, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {open ? (
        <CalendarModal
          value={value}
          today={today}
          onClose={() => setOpen(false)}
          onPick={(d) => {
            onChange(d)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function CalendarModal({
  value,
  today,
  onClose,
  onPick,
}: {
  value: string
  today: string
  onClose: () => void
  onPick: (date: string) => void
}) {
  const c = useColors()
  const [month, setMonth] = useState<Month>(monthOf(value))
  const { year, month: m } = parseMonth(month)
  // Lunes = 0
  const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7
  const days = daysInMonth(month)
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={() => undefined}>
          <View style={{ alignItems: 'center' }}>
            <MonthStepper value={month} onChange={setMonth} size="sm" />
          </View>
          <View style={styles.grid}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`w${String(i)}`} style={[styles.weekday, { color: c.mutedForeground }]}>
                {d}
              </Text>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <View key={`e${String(i)}`} style={styles.cell} />
              const date = toDate(year, m, day)
              const selected = date === value
              const isToday = date === today
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={formatDayHeading(date)}
                  accessibilityState={{ selected }}
                  onPress={() => onPick(date)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.day,
                      selected && { backgroundColor: c.primary },
                      !selected && isToday && { borderWidth: 1, borderColor: c.primary },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? c.primaryForeground : c.foreground,
                        fontWeight: selected || isToday ? '700' : '400',
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.actions}>
            <Button label="Hoy" variant="ghost" size="sm" onPress={() => onPick(today)} />
            <Button label="Cancelar" variant="outline" size="sm" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    height: 46,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: space(5),
  },
  sheet: { borderRadius: radius.xl, padding: space(4), gap: space(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2) },
})
