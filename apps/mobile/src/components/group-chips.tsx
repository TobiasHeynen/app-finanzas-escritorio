import { ScrollView, StyleSheet, View } from 'react-native'
import type { ExpenseGroup } from '@shared/types'
import { Field } from '@/components/form-screen'
import { Chip } from '@/components/ui'
import { useGroupsIndex } from '@/lib/groups'
import { readLastPayer } from '@/lib/prefs'
import { space } from '@/lib/theme'

/**
 * Grupo y quién pagó, como chips. No se muestra si no hay grupos (salvo que el gasto ya tenga uno),
 * así quien no usa grupos no ve nada nuevo.
 */
export function GroupChips({
  value,
  onChange,
  error,
}: {
  value: ExpenseGroup | null
  onChange: (group: ExpenseGroup | null) => void
  error?: string | undefined
}) {
  const index = useGroupsIndex()
  const groups = index.groups.filter((g) => !g.archived || g.id === value?.groupId)
  if (groups.length === 0) return null

  const selected = value ? index.groupById.get(value.groupId) : undefined
  const members = (selected?.members ?? []).filter(
    (m) => !m.archived || m.id === value?.paidByMemberId,
  )

  const pickGroup = (groupId: number) => {
    const g = index.groupById.get(groupId)
    const candidates = g?.members.filter((m) => !m.archived) ?? []
    const last = readLastPayer(groupId)
    const payer = candidates.find((m) => m.id === last) ?? candidates[0]
    if (g && payer) onChange({ groupId: g.id, paidByMemberId: payer.id })
  }

  return (
    <>
      <Field label="Grupo" error={error}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            <Chip
              label="Personal"
              selected={value === null}
              onPress={() => {
                onChange(null)
              }}
            />
            {groups.map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                selected={value?.groupId === g.id}
                onPress={() => {
                  pickGroup(g.id)
                }}
              />
            ))}
          </View>
        </ScrollView>
      </Field>
      {value ? (
        <Field label="Pagó">
          <View style={styles.wrap}>
            {members.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={value.paidByMemberId === m.id}
                onPress={() => {
                  onChange({ ...value, paidByMemberId: m.id })
                }}
              />
            ))}
          </View>
        </Field>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
})
