import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Cloud,
  CloudUpload,
  LoaderCircle,
  LogOut,
  Monitor,
  RotateCcw,
  Smartphone,
  TriangleAlert,
} from 'lucide-react'
import type { CloudBackupInfo } from '@shared/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { call } from '@renderer/lib/api'
import { keys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'

const when = (iso: string) => format(new Date(iso), "d/MM/yyyy 'a las' HH:mm")

/** Backup automático en la carpeta oculta de Chanchito en Google Drive (opcional). */
export function CloudSection({ onRestarting }: { onRestarting: () => void }) {
  const { data: status } = useApiQuery('cloud:status', {}, keys.cloud)
  const [showList, setShowList] = useState(false)
  const list = useApiQuery('cloud:list', {}, keys.cloudList, {
    enabled: showList && status?.connected === true,
  })
  const [confirming, setConfirming] = useState<CloudBackupInfo | null>(null)
  // Al conectar en un equipo nuevo: el backup más reciente de otro dispositivo, para ofrecer restaurarlo.
  const [offer, setOffer] = useState<CloudBackupInfo | null>(null)

  const backupNow = useApiMutation('cloud:backupNow', {
    invalidate: [keys.cloud, keys.cloudList],
    success: 'Backup subido a Google Drive',
  })
  const connect = useApiMutation('cloud:connect', {
    invalidate: [keys.cloud],
    onSuccess: (s) => {
      if (!s.connected) return
      void call('cloud:list', {})
        .then((backups) => {
          const fromOthers = backups.filter((b) => !b.thisDevice)
          if (fromOthers[0]) setOffer(fromOthers[0])
          else backupNow.mutate({})
        })
        .catch(() => backupNow.mutate({}))
    },
  })
  const disconnect = useApiMutation('cloud:disconnect', {
    invalidate: [keys.cloud, keys.cloudList],
    success: 'Desconectaste tu cuenta de Google',
  })
  const restore = useApiMutation('cloud:restore', {
    onSuccess: ({ restarting }) => restarting && onRestarting(),
  })

  if (!status?.available) return null

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <Cloud className="mt-0.5 size-5 text-primary" />
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="font-semibold">Backup en Google Drive</h3>
          {status.connected ? (
            <>
              <p className="text-sm text-muted-foreground">
                Conectado como <span className="font-medium text-foreground">{status.email}</span>.
                Se sube un backup por día y al cerrar la app si cargaste algo. Se guardan los
                últimos 7 de cada dispositivo.
              </p>
              <p className="text-sm">
                {status.lastBackupAt
                  ? `Último backup: ${formatDistanceToNow(new Date(status.lastBackupAt), { addSuffix: true, locale: es })}.`
                  : 'Todavía no se subió ningún backup.'}
              </p>
              {status.lastError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="size-4" /> El último intento falló: {status.lastError}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Opcional. Chanchito guarda una copia de tus datos en una carpeta oculta de tu Drive
              que sólo ve la app: no puede leer el resto de tus archivos. Si cambiás de computadora
              o de celular, te logueás y recuperás todo.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status.connected ? (
          <>
            <Button onClick={() => backupNow.mutate({})} disabled={backupNow.isPending}>
              {backupNow.isPending ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}
              Subir backup ahora
            </Button>
            <Button variant="outline" onClick={() => setShowList((v) => !v)}>
              <RotateCcw /> {showList ? 'Ocultar backups de Drive' : 'Restaurar desde Drive…'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => disconnect.mutate({})}
              disabled={disconnect.isPending}
            >
              <LogOut /> Desconectar
            </Button>
          </>
        ) : (
          <Button onClick={() => connect.mutate({})} disabled={connect.isPending}>
            {connect.isPending ? <LoaderCircle className="animate-spin" /> : <Cloud />}
            {connect.isPending ? 'Elegí tu cuenta en el navegador…' : 'Conectar con Google'}
          </Button>
        )}
      </div>

      {status.connected && showList && (
        <div className="rounded-lg border">
          {list.isLoading ? (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Buscando backups en tu Drive…
            </p>
          ) : !list.data || list.data.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Todavía no hay backups en tu Drive.
            </p>
          ) : (
            <ul className="divide-y">
              {list.data.map((b) => (
                <li key={b.id} className="group flex items-center gap-3 px-4 py-2.5">
                  {b.platform === 'pc' ? (
                    <Monitor className="size-4 text-muted-foreground" />
                  ) : (
                    <Smartphone className="size-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm font-medium first-letter:uppercase">
                    {format(new Date(b.createdAt), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </span>
                  <Badge variant="secondary">{b.thisDevice ? 'Este equipo' : b.deviceName}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setConfirming(b)}
                  >
                    <RotateCcw /> Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar este backup de Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming &&
                `Tus datos actuales se reemplazan por los del ${when(confirming.createdAt)}.`}{' '}
              Antes hacemos un backup de lo que tenés ahora, por las dudas. La app se reinicia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && restore.mutate({ id: confirming.id })}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={offer !== null} onOpenChange={(o) => !o && setOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encontramos un backup en tu Drive</AlertDialogTitle>
            <AlertDialogDescription>
              {offer &&
                `Hay un backup de ${offer.deviceName === 'PC' ? 'otra PC' : 'tu celular'} del ${when(offer.createdAt)}. ¿Querés traer esos datos a esta computadora? Lo que tenés acá se reemplaza (antes hacemos un backup local, por las dudas).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => backupNow.mutate({})}>
              No, seguir con estos datos
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => offer && restore.mutate({ id: offer.id })}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
