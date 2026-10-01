import { useMutation } from '@tanstack/react-query'
import { Activity, Wallet } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@renderer/components/ui/card'
import { call } from '@renderer/lib/api'

export function App() {
  const ping = useMutation({
    mutationFn: () => call('app:ping', { message: 'hola desde el renderer' }),
  })

  return (
    <main className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Wallet className="size-6" />
          </div>
          <CardTitle className="text-2xl">Mis Finanzas</CardTitle>
          <CardDescription>Fase 0: ventana segura y API de IPC funcionando.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={() => ping.mutate()} disabled={ping.isPending}>
            <Activity />
            Probar IPC
          </Button>
          {ping.isSuccess && (
            <dl
              className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
              data-testid="ping-result"
            >
              <dt className="text-muted-foreground">Respuesta</dt>
              <dd>{ping.data.reply}</dd>
              <dt className="text-muted-foreground">App</dt>
              <dd className="money">{ping.data.versions.app}</dd>
              <dt className="text-muted-foreground">Electron</dt>
              <dd className="money">{ping.data.versions.electron}</dd>
              <dt className="text-muted-foreground">Node</dt>
              <dd className="money">{ping.data.versions.node}</dd>
            </dl>
          )}
          {ping.isError && <p className="text-sm text-destructive">{ping.error.message}</p>}
        </CardContent>
      </Card>
    </main>
  )
}
