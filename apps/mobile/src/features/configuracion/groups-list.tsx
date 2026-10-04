import { useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { Archive, ArchiveRestore, Plus, Users } from 'lucide-react-native'
import type { Group } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { ListItem } from '@/components/list-item'
import { Screen } from '@/components/screen'
import { Button, Muted } from '@/components/ui'
import { useGroups } from '@/lib/groups'
import { keys, movementKeys, useApiMutation } from '@/lib/hooks'
import { openWith } from '@/lib/nav-payload'
import { space, useColors } from '@/lib/theme'

export function openGroup(group: Group | null): void {
  openWith<Group | null>('/config/grupo', group)
}

export function GroupsList() {
  const c = useColors()
  const { data: groups = [] } = useGroups()
  const [showArchived, setShowArchived] = useState(false)
  const archive = useApiMutation('groups:archive', {
    invalidate: [keys.groups, ...movementKeys],
    success: (g) => (g.archived ? `"${g.name}" archivado` : `"${g.name}" restaurado`),
  })
  const visible = groups.filter((g) => showArchived || !g.archived)

  return (
    <Screen
      back
      title="Grupos"
      right={
        <Button
          label="Nuevo"
          size="sm"
          icon={<Plus color={c.primaryForeground} size={16} />}
          onPress={() => openGroup(null)}
        />
      }
    >
      <Muted>
        Para gastos compartidos con tu pareja, amigos o en un viaje. Las personas son sólo nombres:
        no necesitan cuenta ni mail.
      </Muted>
      {groups.some((g) => g.archived) ? (
        <View style={styles.switchRow}>
          <Text style={{ color: c.mutedForeground }}>Ver archivados</Text>
          <Switch
            accessibilityLabel="Ver archivados"
            value={showArchived}
            onValueChange={setShowArchived}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#ffffff"
          />
        </View>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Users color={c.mutedForeground} size={32} />}
          title="Todavía no armaste ningún grupo"
          description="Creá uno y al cargar un gasto vas a poder elegir el grupo y quién pagó."
        />
      ) : (
        <View style={{ gap: space(2) }}>
          {visible.map((g) => (
            <ListItem
              key={g.id}
              muted={g.archived}
              chevron={false}
              icon={<Users color={c.primary} size={22} />}
              title={g.archived ? `${g.name} (archivado)` : g.name}
              subtitle={g.members
                .filter((m) => !m.archived)
                .map((m) => m.name)
                .join(', ')}
              onPress={() => openGroup(g)}
              right={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    g.archived ? (
                      <ArchiveRestore color={c.mutedForeground} size={16} />
                    ) : (
                      <Archive color={c.mutedForeground} size={16} />
                    )
                  }
                  accessibilityLabel={g.archived ? `Restaurar ${g.name}` : `Archivar ${g.name}`}
                  onPress={() => archive.mutate({ id: g.id, archived: !g.archived })}
                />
              }
            />
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
