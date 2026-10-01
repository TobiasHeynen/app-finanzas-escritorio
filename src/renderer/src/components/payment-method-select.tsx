import type { PaymentMethod } from '@shared/types'
import { PaymentMethodIcon } from '@renderer/components/payment-method-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'

export function PaymentMethodSelect({
  methods,
  value,
  onChange,
  id,
  invalid,
}: {
  methods: PaymentMethod[]
  value: number | null
  onChange: (id: number) => void
  id?: string
  invalid?: boolean
}) {
  const visible = methods.filter((m) => !m.archived || m.id === value)
  return (
    <Select value={value?.toString() ?? ''} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder="Elegí cómo pagaste" />
      </SelectTrigger>
      <SelectContent>
        {visible.map((m) => (
          <SelectItem key={m.id} value={m.id.toString()}>
            <PaymentMethodIcon method={m} className="size-6 rounded-md [&_svg]:size-3.5" />
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
