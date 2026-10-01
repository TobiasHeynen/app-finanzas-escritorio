import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DatabaseBackup, FolderOpen, History, LoaderCircle, RotateCcw, Upload } from 'lucide-react'
import type { BackupInfo } from '@shared/types'
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
import { Skeleton } from '@renderer/components/ui/skeleton'
import { keys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'

const REASON_LABELS: Record<BackupInfo['reason'], string> = {
  inicio: 'Automático',
  manual: 'Manual',
  'pre-migracion': 'Antes de actualizar',
  'pre-restauracion': 'Antes de restaurar',
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`

/** Lo que se va a restaurar: un backup de la lista o un archivo a elegir. */
type RestoreTarget = { kind: 'backup'; backup: BackupInfo } | { kind: 'file' }

export function BackupsSection() {
  const { data: backups, isLoading } = useApiQuery('backups:list', {}, keys.backups)
  const [confirming, setConfirming] = useState<RestoreTarget | null>(null)
  const [restarting, setRestarting] = useState(false)

  const create = useApiMutation('backups:create', {
    invalidate: [keys.backups],
    success: 'Backup hecho',
  })
  const openFolder = useApiMutation('backups:openFolder')
  const onRestored = ({ restarting: r }: { restarting: boolean }) => setRestarting(r)
  const restore = useApiMutation('backups:restore', { onSuccess: onRestored })
  const restoreFile = useApiMutation('backups:restoreFromFile', { onSuccess: onRestored })

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Backups</h2>
        <p className="text-sm text-muted-foreground">
          Cada vez que abrís la app se hace un backup de tus datos. Se guardan los últimos 15 de
          cada tipo en la carpeta de la app.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => create.mutate({})} disabled={create.isPending}>
          {create.isPending ? <LoaderCircle className="animate-spin" /> : <DatabaseBackup />}
          Hacer backup ahora
        </Button>
        <Button variant="outline" onClick={() => openFolder.mutate({})}>
          <FolderOpen /> Abrir carpeta de backups
        </Button>
        <Button variant="outline" onClick={() => setConfirming({ kind: 'file' })}>
          <Upload /> Restaurar desde un archivo…
        </Button>
      </div>

      <Card className="gap-0 py-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : !backups || backups.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
            <History className="size-4" /> Todavía no hay backups. Se hace uno la próxima vez que
            abras la app, o ahora con el botón de arriba.
          </p>
        ) : (
          <ul className="divide-y">
            {backups.map((b) => (
              <li key={b.name} className="group flex items-center gap-3 px-5 py-2.5">
                <DatabaseBackup className="size-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium first-letter:uppercase">
                    {format(new Date(b.createdAt), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {b.name} · {formatSize(b.sizeBytes)}
                  </span>
                </div>
                <Badge variant="secondary">{REASON_LABELS[b.reason]}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setConfirming({ kind: 'backup', backup: b })}
                >
                  <RotateCcw /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.kind === 'backup'
                ? `Tus datos actuales se reemplazan por los del ${format(new Date(confirming.backup.createdAt), "d/MM/yyyy 'a las' HH:mm")}.`
                : 'Vas a elegir un archivo de backup y tus datos actuales se reemplazan por los de ese archivo.'}{' '}
              Antes hacemos un backup de lo que tenés ahora, por las dudas. La app se reinicia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming?.kind === 'backup') restore.mutate({ name: confirming.backup.name })
                else restoreFile.mutate({})
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {restarting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <p className="font-medium">Restaurando… la app se reinicia en un momento.</p>
        </div>
      )}
    </section>
  )
}
