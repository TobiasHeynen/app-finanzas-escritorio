import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronDown, X } from 'lucide-react-native'
import { useCatalog } from '@/lib/catalog'
import { radius, space, useColors } from '@/lib/theme'
import { CategoryIcon } from './icons'
import { Chip, TextField } from './ui'

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Elige categoría › subcategoría en una pantalla con buscador (sin las archivadas). */
export function SubcategoryPicker({
  value,
  onChange,
  invalid,
}: {
  value: number | null
  onChange: (id: number) => void
  invalid?: boolean
}) {
  const c = useColors()
  const { categories, subcategoryById } = useCatalog()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = value !== null ? subcategoryById.get(value) : undefined

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return categories
      .filter((cat) => !cat.archived)
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories.filter(
          (s) =>
            (!s.archived || s.id === value) &&
            (!q || normalize(`${cat.name} ${s.name}`).includes(q)),
        ),
      }))
      .filter((cat) => cat.subcategories.length > 0)
  }, [categories, query, value])

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Elegir categoría"
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
        {selected ? (
          <CategoryIcon icon={selected.category.icon} color={selected.category.color} size="sm" />
        ) : null}
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 16, color: selected ? c.foreground : c.mutedForeground }}
        >
          {selected ? `${selected.category.name} › ${selected.name}` : 'Elegí una categoría'}
        </Text>
        <ChevronDown color={c.mutedForeground} size={18} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.foreground }]}>Categoría</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={10}
              onPress={() => setOpen(false)}
            >
              <X color={c.foreground} size={24} />
            </Pressable>
          </View>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar (ej.: super, nafta)"
            autoCorrect={false}
          />
          <FlatList
            data={visible}
            keyExtractor={(cat) => String(cat.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space(4), paddingVertical: space(3) }}
            renderItem={({ item: cat }) => (
              <View style={{ gap: space(2) }}>
                <View style={styles.catHeader}>
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  <Text style={[styles.catName, { color: c.foreground }]}>{cat.name}</Text>
                </View>
                <View style={styles.chips}>
                  {cat.subcategories.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      color={cat.color}
                      selected={s.id === value}
                      onPress={() => {
                        onChange(s.id)
                        setOpen(false)
                        setQuery('')
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: c.mutedForeground, textAlign: 'center', padding: space(6) }}>
                No hay categorías con “{query}”.
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
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
    height: 48,
  },
  modal: { flex: 1, padding: space(4), gap: space(3) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  catName: { fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
})
