import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import type { Category } from '@shared/types'
import { Field, FormScreen } from '@/components/form-screen'
import { CategoryIcon } from '@/components/icons'
import { ColorPicker, IconPicker } from '@/components/pickers'
import { TextField } from '@/components/ui'
import { keys, useApiMutation } from '@/lib/hooks'
import { space } from '@/lib/theme'

export function CategoryForm({ category }: { category: Category | null }) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'tag')
  const [color, setColor] = useState(category?.color ?? '#6366f1')
  const [error, setError] = useState<string>()
  const options = {
    invalidate: [keys.categories],
    toastErrors: false,
    onSuccess: () => router.back(),
  }
  const create = useApiMutation('catalog:createCategory', {
    ...options,
    success: 'Categoría creada',
  })
  const update = useApiMutation('catalog:updateCategory', {
    ...options,
    success: 'Categoría guardada',
  })

  const submit = () => {
    if (!name.trim()) {
      setError('Poné un nombre')
      return
    }
    const input = { name: name.trim(), icon, color }
    const onError = (err: Error) => {
      setError(err.message)
    }
    if (category) update.mutate({ id: category.id, ...input }, { onError })
    else create.mutate(input, { onError })
  }

  return (
    <FormScreen
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      description="La categoría es qué compraste (no cómo lo pagaste)."
      onSave={submit}
      saving={create.isPending || update.isPending}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <CategoryIcon icon={icon} color={color} size="lg" />
        <View style={{ flex: 1 }}>
          <Field label="Nombre" error={error}>
            <TextField
              autoFocus={!category}
              value={name}
              maxLength={60}
              invalid={Boolean(error)}
              onChangeText={(v) => {
                setName(v)
                setError(undefined)
              }}
            />
          </Field>
        </View>
      </View>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Ícono">
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </Field>
    </FormScreen>
  )
}
