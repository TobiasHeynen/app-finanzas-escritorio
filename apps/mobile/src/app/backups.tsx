import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { DatabaseBackup, FileUp, Laptop, Smartphone } from 'lucide-react-native'
import type { BackupInfo } from '@shared/types'
import { ChoiceSheet } from '@/components/choice-sheet'
import { Screen } from '@/components/screen'
import { Button, Card, Muted, SectionTitle } from '@/components/ui'
import { shareBackup } from '@/lib/backups'
import { keys, useApiMutation, useApiQuery } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'
import { toast } from '@/lib/toast'

const REASON_LABELS: Record<BackupInfo['reason'], string> = {
  inicio: 'Automático',
  manual: 'Manual',
  'pre-migracion': 'Antes de actualizar',
  'pre-restauracion': 'Antes de restaurar',
}

/** "finanzas-20261002-140501-manual.db" → "02/10/2026 14:05". */
function backupDate(name: string): string {
  const m = /^finanzas-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(name)
  return m ? `${m[3] ?? ''}/${m[2] ?? ''}/${m[1] ?? ''} ${m[4] ?? ''}:${m[5] ?? ''}` : name
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${(Math.round((bytes / 1024 / 1024) * 10) / 10).toString().replace('.', ',')} MB`

type Confirm = { kind: 'backup'; backup: BackupInfo } | { kind: 'file' } | null

export default function BackupsScreen() {
  const c = useColors()
  const { data: backups, isLoading } = useApiQuery('backups:list', {}, keys.backups)
  const [selected, setSelected] = useState<BackupInfo | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [restarting, setRestarting] = useState(false)

  const create = useApiMutation('backups:create', {
    invalidate: [keys.backups],
    success: 'Backup hecho',
  })
  const onRestored = ({ restarting: r }: { restarting: boolean }) => {
    setRestarting(r)
  }
  const restore = useApiMutation('backups:restore', { onSuccess: onRestored })
  const restoreFile = useApiMutation('backups:restoreFromFile', { onSuccess: onRestored })

  const share = (name: string) => {
    shareBackup(name)
      .then((ok) => {
        if (!ok) toast.error('No hay ninguna app para compartir el archivo')
      })
      .catch(() => toast.error('No se pudo compartir el backup'))
  }

  return (
    <Screen back title="Backups y pasar datos">
      <Muted>
        Se hace un backup cada vez que abrís la app y se guardan los últimos 15 de cada tipo.
        Android además copia los datos de la app a tu cuenta de Google.
      </Muted>
      <View style={{ gap: space(3) }}>
        <Button
          label="Hacer un backup ahora"
          icon={<DatabaseBackup color={c.primaryForeground} size={18} />}
          loading={create.isPending}
          onPress={() => create.mutate({})}
        />
        <Button
          label="Restaurar desde un archivo"
          variant="outline"
          icon={<FileUp color={c.foreground} size={18} />}
          disabled={restoreFile.isPending}
          onPress={() => setConfirm({ kind: 'file' })}
        />
      </View>

      <Card style={{ gap: space(3) }}>
        <Text style={[styles.title, { color: c.foreground }]}>
          Pasar los datos entre la PC y el celu
        </Text>
        <View style={styles.step}>
          <Smartphone color={c.primary} size={18} />
          <Text style={[styles.stepText, { color: c.foreground }]}>
            <Text style={styles.strong}>Del celu a la PC:</Text> tocá un backup de la lista →
            Compartir (Drive, mail, WhatsApp). En la PC: Configuración → Backups → Restaurar desde
            archivo.
          </Text>
        </View>
        <View style={styles.step}>
          <Laptop color={c.primary} size={18} />
          <Text style={[styles.stepText, { color: c.foreground }]}>
            <Text style={styles.strong}>De la PC al celu:</Text> en la PC, Configuración → Backups →
            Abrir carpeta y mandate el último archivo. Acá: Restaurar desde un archivo.
          </Text>
        </View>
        <Muted style={{ fontSize: 12 }}>
          Restaurar reemplaza todos los datos de este dispositivo por los del backup.
        </Muted>
      </Card>

      <View style={{ gap: space(2) }}>
        <SectionTitle>Backups en este celu</SectionTitle>
        {isLoading || !backups ? (
          <ActivityIndicator color={c.primary} />
        ) : backups.length === 0 ? (
          <Muted>Todavía no hay backups.</Muted>
        ) : (
          <Card style={{ paddingHorizontal: space(2), paddingVertical: space(1) }}>
            {backups.map((b) => (
              <Pressable
                key={b.name}
                accessibilityRole="button"
                testID="backup-row"
                onPress={() => setSelected(b)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.foreground }]}>
                    {backupDate(b.name)}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {REASON_LABELS[b.reason]} · {formatSize(b.sizeBytes)}
                  </Muted>
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </View>

      <ChoiceSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Backup del ${backupDate(selected.name)}` : ''}
        choices={
          selected
            ? [
                { label: 'Compartir', variant: 'primary', onPress: () => share(selected.name) },
                {
                  label: 'Restaurar',
                  onPress: () => setConfirm({ kind: 'backup', backup: selected }),
                },
              ]
            : []
        }
      />
      <ChoiceSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === 'backup'
            ? `¿Restaurar el backup del ${backupDate(confirm.backup.name)}?`
            : '¿Restaurar desde un archivo?'
        }
        description="Todos los datos de este dispositivo se reemplazan por los del backup. Antes se guarda un backup de seguridad de lo que tenés ahora, y la app se reinicia."
        choices={[
          {
            label: confirm?.kind === 'file' ? 'Elegir archivo' : 'Restaurar',
            variant: 'destructive',
            onPress: () => {
              if (confirm?.kind === 'backup') restore.mutate({ name: confirm.backup.name })
              else restoreFile.mutate({})
            },
          },
        ]}
      />
      <Modal visible={restarting} transparent animationType="fade">
        <View style={[styles.overlay, { backgroundColor: `${c.background}ee` }]}>
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={{ color: c.foreground, fontWeight: '600' }}>
            Restaurando… la app se reinicia en un momento.
          </Text>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  step: { flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  strong: { fontWeight: '700' },
  row: { paddingVertical: space(2.5), paddingHorizontal: space(2), borderRadius: radius.md },
  rowTitle: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(3) },
})
