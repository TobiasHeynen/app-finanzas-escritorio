import { useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from 'lucide-react-native'
import type { Category, Subcategory } from '@shared/types'
import { CategoryIcon } from '@/components/icons'
import { moveItem, ReorderButtons } from '@/components/list-item'
import { Screen } from '@/components/screen'
import { Button, Muted, TextField } from '@/components/ui'
import { useCategories } from '@/lib/catalog'
import { keys, useApiMutation } from '@/lib/hooks'
import { openWith } from '@/lib/nav-payload'
import { radius, space, useColors } from '@/lib/theme'

export function openCategory(category: Category | null): void {
  openWith<Category | null>('/config/categoria', category)
}

export function CategoriesList() {
  const c = useColors()
  const { data: categories = [] } = useCategories()
  const [showArchived, setShowArchived] = useState(false)
  const reorder = useApiMutation('catalog:reorderCategories', { invalidate: [keys.categories] })
  const visible = categories.filter((cat) => showArchived || !cat.archived)

  const move = (from: number, to: number) => {
    const ordered = moveItem(visible, from, to)
    const hidden = categories.filter((cat) => !visible.includes(cat))
    reorder.mutate({ ids: [...ordered, ...hidden].map((cat) => cat.id) })
  }

  return (
    <Screen
      back
      title="Categorías"
      right={
        <Button
          label="Nueva"
          size="sm"
          icon={<Plus color={c.primaryForeground} size={16} />}
          onPress={() => openCategory(null)}
        />
      }
    >
      <Muted>
        Archivar no borra el histórico: lo archivado no aparece al cargar gastos, pero sí en
        reportes.
      </Muted>
      <View style={styles.switchRow}>
        <Text style={{ color: c.mutedForeground }}>Ver archivadas</Text>
        <Switch
          accessibilityLabel="Ver archivadas"
          value={showArchived}
          onValueChange={setShowArchived}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={{ gap: space(2) }}>
        {visible.map((cat, index) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            index={index}
            count={visible.length}
            showArchived={showArchived}
            onMove={move}
          />
        ))}
      </View>
    </Screen>
  )
}

function CategoryRow({
  category,
  index,
  count,
  showArchived,
  onMove,
}: {
  category: Category
  index: number
  count: number
  showArchived: boolean
  onMove: (from: number, to: number) => void
}) {
  const c = useColors()
  const [open, setOpen] = useState(false)
  const archive = useApiMutation('catalog:archiveCategory', {
    invalidate: [keys.categories],
    success: (cat) => (cat.archived ? `"${cat.name}" archivada` : `"${cat.name}" restaurada`),
  })
  const subs = category.subcategories.filter((s) => showArchived || !s.archived)
  const activeSubs = category.subcategories.filter((s) => !s.archived)

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, opacity: category.archived ? 0.6 : 1 },
      ]}
    >
      <View style={styles.row}>
        <ReorderButtons index={index} count={count} onMove={onMove} label={category.name} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${open ? 'Cerrar' : 'Abrir'} ${category.name}`}
          onPress={() => setOpen(!open)}
          style={styles.toggle}
        >
          {open ? (
            <ChevronDown color={c.mutedForeground} size={16} />
          ) : (
            <ChevronRight color={c.mutedForeground} size={16} />
          )}
          <CategoryIcon icon={category.icon} color={category.color} muted={category.archived} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ color: c.foreground, fontWeight: '600', fontSize: 15 }}
            >
              {category.name}
              {category.archived ? ' (archivada)' : ''}
            </Text>
            <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>
              {activeSubs.length === 0
                ? 'Sin subcategorías'
                : activeSubs.map((s) => s.name).join(' · ')}
            </Text>
          </View>
        </Pressable>
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil color={c.mutedForeground} size={16} />}
          accessibilityLabel={`Editar ${category.name}`}
          onPress={() => openCategory(category)}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={
            category.archived ? (
              <ArchiveRestore color={c.mutedForeground} size={16} />
            ) : (
              <Archive color={c.mutedForeground} size={16} />
            )
          }
          accessibilityLabel={
            category.archived ? `Restaurar ${category.name}` : `Archivar ${category.name}`
          }
          onPress={() => archive.mutate({ id: category.id, archived: !category.archived })}
        />
      </View>
      {open ? (
        <View style={[styles.subs, { borderTopColor: c.border }]}>
          {subs.map((sub, i) => (
            <SubcategoryRow
              key={sub.id}
              sub={sub}
              index={i}
              list={subs}
              allSubs={category.subcategories}
              categoryId={category.id}
            />
          ))}
          <AddSubcategory categoryId={category.id} />
        </View>
      ) : null}
    </View>
  )
}

function SubcategoryRow({
  sub,
  index,
  list,
  allSubs,
  categoryId,
}: {
  sub: Subcategory
  index: number
  list: Subcategory[]
  allSubs: Subcategory[]
  categoryId: number
}) {
  const c = useColors()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sub.name)
  const rename = useApiMutation('catalog:renameSubcategory', {
    invalidate: [keys.categories],
    onSuccess: () => setEditing(false),
  })
  const archive = useApiMutation('catalog:archiveSubcategory', {
    invalidate: [keys.categories],
    success: (s) => (s.archived ? `"${s.name}" archivada` : `"${s.name}" restaurada`),
  })
  const reorder = useApiMutation('catalog:reorderSubcategories', { invalidate: [keys.categories] })
  const move = (from: number, to: number) => {
    const ordered = moveItem(list, from, to)
    const hidden = allSubs.filter((s) => !list.includes(s))
    reorder.mutate({ categoryId, ids: [...ordered, ...hidden].map((s) => s.id) })
  }

  return (
    <View style={[styles.subRow, { opacity: sub.archived ? 0.6 : 1 }]}>
      <ReorderButtons index={index} count={list.length} onMove={move} label={sub.name} />
      {editing ? (
        <>
          <TextField
            autoFocus
            value={name}
            maxLength={60}
            onChangeText={setName}
            onSubmitEditing={() => {
              if (name.trim()) rename.mutate({ id: sub.id, name: name.trim() })
            }}
            style={{ flex: 1, height: 38 }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Check color={c.primary} size={18} />}
            accessibilityLabel="Guardar"
            onPress={() => {
              if (name.trim()) rename.mutate({ id: sub.id, name: name.trim() })
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<X color={c.mutedForeground} size={18} />}
            accessibilityLabel="Cancelar"
            onPress={() => {
              setEditing(false)
              setName(sub.name)
            }}
          />
        </>
      ) : (
        <>
          <Text style={{ flex: 1, color: c.foreground, fontSize: 14 }}>
            {sub.name}
            {sub.archived ? ' (archivada)' : ''}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil color={c.mutedForeground} size={16} />}
            accessibilityLabel={`Renombrar ${sub.name}`}
            onPress={() => setEditing(true)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={
              sub.archived ? (
                <ArchiveRestore color={c.mutedForeground} size={16} />
              ) : (
                <Archive color={c.mutedForeground} size={16} />
              )
            }
            accessibilityLabel={sub.archived ? `Restaurar ${sub.name}` : `Archivar ${sub.name}`}
            onPress={() => archive.mutate({ id: sub.id, archived: !sub.archived })}
          />
        </>
      )}
    </View>
  )
}

function AddSubcategory({ categoryId }: { categoryId: number }) {
  const c = useColors()
  const [name, setName] = useState('')
  const create = useApiMutation('catalog:createSubcategory', {
    invalidate: [keys.categories],
    success: (s) => `Subcategoría "${s.name}" creada`,
    onSuccess: () => setName(''),
  })
  const submit = () => {
    if (name.trim()) create.mutate({ categoryId, name: name.trim() })
  }
  return (
    <View style={styles.subRow}>
      <TextField
        placeholder="Nueva subcategoría"
        value={name}
        maxLength={60}
        onChangeText={setName}
        onSubmitEditing={submit}
        style={{ flex: 1, height: 38 }}
      />
      <Button
        label="Agregar"
        size="sm"
        variant="secondary"
        icon={<Plus color={c.foreground} size={16} />}
        disabled={!name.trim() || create.isPending}
        onPress={submit}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3) },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(2), minWidth: 0 },
  subs: { borderTopWidth: StyleSheet.hairlineWidth, padding: space(3), gap: space(2) },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
})
