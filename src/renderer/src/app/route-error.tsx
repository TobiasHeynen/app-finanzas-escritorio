import { useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

/** Pantalla de error de una ruta: en vez del error crudo, un mensaje y cómo seguir. */
export function RouteError() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : String(error)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-negative/15 text-negative">
        <TriangleAlert className="size-6" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <h1 className="text-lg font-semibold">Algo salió mal en esta pantalla</h1>
        <p className="text-sm text-muted-foreground">
          Tus datos están a salvo. Probá volver al inicio; si se repite, avisá con este detalle:
        </p>
        <code className="mt-2 rounded bg-muted px-2 py-1 text-xs break-all">{detail}</code>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            window.location.hash = '#/'
            window.location.reload()
          }}
        >
          Volver al inicio
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    </div>
  )
}
