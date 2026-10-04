import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { formatMoney, splitInstallments, sumCents } from '@shared/money'
import type { ExpenseSplit, Group } from '@shared/types'
import { Field } from '@/components/form-screen'
import { MoneyField } from '@/components/money-field'
import { Chip } from '@/components/ui'
import { radius, space, useColors } from '@/lib/theme'

/** Personas que se pueden elegir: las activas y las archivadas que ya estaban en el reparto. */
function candidates(group: Group, split: ExpenseSplit) {
  const inSplit = new Set(
    split.kind === 'equal' ? split.memberIds : split.shares.map((s) => s.memberId),
  )
  return group.members.filter((m) => !m.archived || inSplit.has(m.id))
}

/**
 * Cómo se reparte un gasto de grupo: partes iguales entre las personas marcadas, o un monto a mano para
 * cada una (tiene que sumar el total). Mismo comportamiento que el de la PC.
 */
export function SplitEditor({
  group,
  amount,
  value,
  onChange,
  error,
}: {
  group: Group
  amount: number | null
  value: ExpenseSplit
  onChange: (split: ExpenseSplit) => void
  error?: string | undefined
}) {
  const c = useColors()
  const people = candidates(group, value)

  const toEqual = () => {
    onChange({
      kind: 'equal',
      memberIds:
        value.kind === 'equal'
          ? value.memberIds
          : value.shares.filter((s) => s.cents > 0).map((s) => s.memberId),
    })
  }
  const toCustom = () => {
    const ids = value.kind === 'equal' ? value.memberIds : people.map((m) => m.id)
    const parts = amount !== null && ids.length > 0 ? splitInstallments(amount, ids.length) : []
    onChange({
      kind: 'custom',
      shares: people.map((m) => {
        const i = ids.indexOf(m.id)
        return { memberId: m.id, cents: i === -1 ? 0 : (parts[i] ?? 0) }
      }),
    })
  }

  let equalAmounts = new Map<number, number>()
  if (value.kind === 'equal' && amount !== null && value.memberIds.length > 0) {
    const ordered = people.filter((m) => value.memberIds.includes(m.id)).map((m) => m.id)
    const parts = splitInstallments(amount, ordered.length)
    equalAmounts = new Map(ordered.map((id, i) => [id, parts[i] ?? 0]))
  }
  const assigned = value.kind === 'custom' ? sumCents(value.shares.map((s) => s.cents)) : 0
  const diff = amount === null ? null : amount - assigned

  const toggle = (id: number) => {
    if (value.kind !== 'equal') return
    const has = value.memberIds.includes(id)
    onChange({
      kind: 'equal',
      memberIds: has ? value.memberIds.filter((x) => x !== id) : [...value.memberIds, id],
    })
  }
  const setShare = (id: number, cents: number | null) => {
    if (value.kind !== 'custom') return
    onChange({
      kind: 'custom',
      shares: people.map((m) => ({
        memberId: m.id,
        cents:
          m.id === id ? (cents ?? 0) : (value.shares.find((s) => s.memberId === m.id)?.cents ?? 0),
      })),
    })
  }

  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.muted }]}>
      <Field label="Reparto" error={error}>
        <View style={styles.row}>
          <Chip label="Partes iguales" selected={value.kind === 'equal'} onPress={toEqual} />
          <Chip
            label="A mano"
            selected={value.kind === 'custom'}
            onPress={() => {
              if (amount !== null && value.kind !== 'custom') toCustom()
            }}
          />
        </View>
        <View style={{ gap: space(1) }}>
          {people.map((m) => {
            if (value.kind === 'custom') {
              return (
                <View key={m.id} style={styles.person}>
                  <Text style={[styles.name, { color: c.foreground }]}>{m.name}</Text>
                  <View style={{ width: 150 }}>
                    <MoneyField
                      accessibilityLabel={`Parte de ${m.name}`}
                      value={value.shares.find((s) => s.memberId === m.id)?.cents ?? 0}
                      onValueChange={(cents) => {
                        setShare(m.id, cents)
                      }}
                    />
                  </View>
                </View>
              )
            }
            const checked = value.memberIds.includes(m.id)
            return (
              <Pressable
                key={m.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={m.name}
                onPress={() => {
                  toggle(m.id)
                }}
                style={({ pressed }) => [styles.person, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={[
                    styles.check,
                    { borderColor: checked ? c.primary : c.border },
                    checked && { backgroundColor: c.primary },
                  ]}
                >
                  {checked ? <Check color={c.primaryForeground} size={14} /> : null}
                </View>
                <Text style={[styles.name, { color: c.foreground }]}>{m.name}</Text>
                <Text style={{ color: c.mutedForeground, fontVariant: ['tabular-nums'] }}>
                  {equalAmounts.has(m.id) ? formatMoney(equalAmounts.get(m.id) ?? 0) : '—'}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {value.kind === 'custom' && diff !== null && diff !== 0 ? (
          <Text style={{ color: c.pending, fontSize: 13 }}>
            {diff > 0
              ? `Faltan asignar ${formatMoney(diff)}`
              : `Te pasaste por ${formatMoney(-diff)}`}
          </Text>
        ) : null}
        {amount === null ? (
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
            Se reparte en partes iguales cuando cargues el monto.
          </Text>
        ) : null}
      </Field>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(3),
  },
  row: { flexDirection: 'row', gap: space(2) },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    minHeight: 40,
  },
  name: { flex: 1, fontSize: 15 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
