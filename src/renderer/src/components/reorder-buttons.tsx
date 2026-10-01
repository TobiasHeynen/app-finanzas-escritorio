import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

/** Botones subir/bajar (accesibles por teclado) para reordenar listas sin drag & drop. */
export function ReorderButtons({
  index,
  count,
  onMove,
  label,
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  label: string
}) {
  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label={`Subir ${label}`}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label={`Bajar ${label}`}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  )
}
