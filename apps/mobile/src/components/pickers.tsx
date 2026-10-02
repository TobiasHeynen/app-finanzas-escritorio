import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Check, Tag } from 'lucide-react-native'
import type { PaymentMethod } from '@shared/types'
import { CATEGORY_ICONS, PALETTE } from '@/lib/category-icons'
import { radius, space, useColors } from '@/lib/theme'
import { PaymentMethodIcon } from './icons'
import { Chip } from './ui'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.wrap}>
      {PALETTE.map((color) => (
        <Pressable
          key={color}
          accessibilityRole="radio"
          accessibilityLabel={`Color ${color}`}
          accessibilityState={{ selected: value === color }}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color }]}
        >
          {value === color ? <Check color="#ffffff" size={18} /> : null}
        </Pressable>
      ))}
    </View>
  )
}

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string
  color: string
  onChange: (icon: string) => void
}) {
  const c = useColors()
  return (
    <View style={styles.wrap}>
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
        const selected = name === value
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={`Ícono ${name}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(name)}
            style={[
              styles.icon,
              {
                borderColor: selected ? color : c.border,
                backgroundColor: selected ? `${color}22` : c.card,
              },
            ]}
          >
            <Icon color={selected ? color : c.mutedForeground} size={20} />
          </Pressable>
        )
      })}
      {Object.keys(CATEGORY_ICONS).length === 0 ? <Tag color={c.mutedForeground} /> : null}
    </View>
  )
}

/** Medios de pago como chips en una fila con scroll (sin los archivados, salvo el elegido). */
export function PaymentMethodChips({
  methods,
  value,
  onChange,
}: {
  methods: PaymentMethod[]
  value: number | null
  onChange: (id: number) => void
}) {
  const visible = methods.filter((m) => !m.archived || m.id === value)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {visible.map((m) => (
          <Chip
            key={m.id}
            label={m.name}
            selected={m.id === value}
            icon={<PaymentMethodIcon method={m} size={16} />}
            onPress={() => onChange(m.id)}
          />
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  row: { flexDirection: 'row', gap: space(2) },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
