import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Plus, X } from 'lucide-react-native'
import type { Group } from '@shared/types'
import { Field, FormScreen } from '@/components/form-screen'
import { Button, Muted, TextField } from '@/components/ui'
import type { ApiError } from '@/lib/api'
import { keys, movementKeys, useApiMutation } from '@/lib/hooks'
import { space, useColors } from '@/lib/theme'

interface MemberDraft {
  key: number
  id: number | null
  name: string
}

let nextKey = 0
const draft = (id: number | null, name: string): MemberDraft => ({ key: nextKey++, id, name })

export function GroupForm({ group }: { group: Group | null }) {
  const c = useColors()
  const [name, setName] = useState(group?.name ?? '')
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    group
      ? group.members.filter((m) => !m.archived).map((m) => draft(m.id, m.name))
      : [draft(null, ''), draft(null, '')],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const options = {
    invalidate: [keys.groups, ...movementKeys],
    toastErrors: false,
    onSuccess: () => router.back(),
  }
  const create = useApiMutation('groups:create', { ...options, success: 'Grupo creado' })
  const update = useApiMutation('groups:update', { ...options, success: 'Grupo guardado' })

  const setMember = (key: number, value: string) => {
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, name: value } : m)))
  }

  const submit = () => {
    const filled = members.filter((m) => m.name.trim() !== '')
    const next: Record<string, string> = {}
    if (!name.trim()) next['name'] = 'Poné un nombre'
    if (filled.length < 2) next['members'] = 'Agregá al menos 2 personas'
    const names = filled.map((m) => m.name.trim().toLocaleLowerCase('es-AR'))
    if (new Set(names).size !== names.length) next['members'] = 'Hay nombres repetidos'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const data = {
      name: name.trim(),
      members: filled.map((m) => ({ id: m.id, name: m.name.trim() })),
    }
    const onError = (err: ApiError) => {
      setErrors({ _: err.message, ...err.fields })
    }
    if (group) update.mutate({ id: group.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <FormScreen
      title={group ? 'Editar grupo' : 'Nuevo grupo'}
      description="Si sacás a alguien, sus gastos anteriores siguen diciendo que pagó esa persona."
      onSave={submit}
      saving={create.isPending || update.isPending}
    >
      <Field label="Nombre" error={errors['name']}>
        <TextField
          autoFocus={!group}
          value={name}
          maxLength={60}
          placeholder="Casa, Viaje a Bariloche…"
          invalid={Boolean(errors['name'])}
          onChangeText={setName}
        />
      </Field>
      <Field label="Personas" error={errors['members']}>
        <View style={{ gap: space(2) }}>
          {members.map((m, i) => (
            <View key={m.key} style={styles.memberRow}>
              <TextField
                accessibilityLabel={`Persona ${String(i + 1)}`}
                value={m.name}
                maxLength={40}
                placeholder={i === 0 ? 'Vos' : 'Nombre'}
                style={{ flex: 1 }}
                onChangeText={(v) => {
                  setMember(m.key, v)
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={members.length <= 2}
                icon={<X color={c.mutedForeground} size={18} />}
                accessibilityLabel={`Sacar a ${m.name || 'esta persona'}`}
                onPress={() => {
                  setMembers((list) => list.filter((x) => x.key !== m.key))
                }}
              />
            </View>
          ))}
          <Button
            label="Agregar persona"
            variant="outline"
            size="sm"
            disabled={members.length >= 20}
            icon={<Plus color={c.foreground} size={16} />}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              setMembers((list) => [...list, draft(null, '')])
            }}
          />
        </View>
      </Field>
      {errors['_'] ? <Muted style={{ color: c.negative }}>{errors['_']}</Muted> : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
})
