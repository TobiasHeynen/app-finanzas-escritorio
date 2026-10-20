import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Cloud, CloudUpload, Laptop, LogOut, Smartphone } from 'lucide-react-native'
import type { CloudBackupInfo } from '@shared/types'
import { ChoiceSheet } from '@/components/choice-sheet'
import { Button, Card, Muted } from '@/components/ui'
import { call } from '@/lib/api'
import { keys, useApiMutation, useApiQuery } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'

const when = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'a las' HH:mm")

/** Backup automático en la carpeta oculta de Chanchito en Google Drive (opcional). */
export function CloudCard({ onRestarting }: { onRestarting: () => void }) {
  const c = useColors()
  const { data: status } = useApiQuery('cloud:status', {}, keys.cloud)
  const [showList, setShowList] = useState(false)
  const list = useApiQuery('cloud:list', {}, keys.cloudList, {
    enabled: showList && status?.connected === true,
  })
  const [confirming, setConfirming] = useState<CloudBackupInfo | null>(null)
  // Al conectar en un celu nuevo: el backup más reciente de otro dispositivo, para ofrecer restaurarlo.
  const [offer, setOffer] = useState<CloudBackupInfo | null>(null)

  const backupNow = useApiMutation('cloud:backupNow', {
    invalidate: [keys.cloud, keys.cloudList],
    success: 'Backup subido a Google Drive',
  })
  const connect = useApiMutation('cloud:connect', {
    invalidate: [keys.cloud],
    onSuccess: (s) => {
      if (!s.connected) return
      call('cloud:list', {})
        .then((backups) => {
          const fromOthers = backups.find((b) => !b.thisDevice)
          if (fromOthers) setOffer(fromOthers)
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
    <Card style={{ gap: space(3) }}>
      <View style={styles.header}>
        <Cloud color={c.primary} size={20} />
        <Text style={[styles.title, { color: c.foreground }]}>Backup en Google Drive</Text>
      </View>
      {status.connected ? (
        <>
          <Muted>
            Conectado como {status.email}. Se sube un backup por día y cuando salís de la app si
            cargaste algo. Se guardan los últimos 7 de cada dispositivo.
          </Muted>
          <Text style={{ color: c.foreground }}>
            {status.lastBackupAt
              ? `Último backup: ${formatDistanceToNow(new Date(status.lastBackupAt), { addSuffix: true, locale: es })}.`
              : 'Todavía no se subió ningún backup.'}
          </Text>
          {status.lastError ? (
            <Text style={{ color: c.negative }}>El último intento falló: {status.lastError}</Text>
          ) : null}
          <Button
            label="Subir backup ahora"
            icon={<CloudUpload color={c.primaryForeground} size={18} />}
            loading={backupNow.isPending}
            onPress={() => backupNow.mutate({})}
          />
          <Button
            label={showList ? 'Ocultar backups de Drive' : 'Restaurar desde Drive'}
            variant="outline"
            onPress={() => setShowList((v) => !v)}
          />
          {showList &&
            (list.isLoading ? (
              <ActivityIndicator color={c.primary} />
            ) : !list.data || list.data.length === 0 ? (
              <Muted>Todavía no hay backups en tu Drive.</Muted>
            ) : (
              <View>
                {list.data.map((b) => (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    onPress={() => setConfirming(b)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}
                  >
                    {b.platform === 'android' ? (
                      <Smartphone color={c.mutedForeground} size={16} />
                    ) : (
                      <Laptop color={c.mutedForeground} size={16} />
                    )}
                    <Text style={[styles.rowTitle, { color: c.foreground }]}>
                      {when(b.createdAt)}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      {b.thisDevice ? 'Este celu' : b.deviceName}
                    </Muted>
                  </Pressable>
                ))}
              </View>
            ))}
          <Button
            label="Desconectar"
            variant="ghost"
            icon={<LogOut color={c.foreground} size={18} />}
            disabled={disconnect.isPending}
            onPress={() => disconnect.mutate({})}
          />
        </>
      ) : (
        <>
          <Muted>
            Opcional. Chanchito guarda una copia de tus datos en una carpeta oculta de tu Drive que
            sólo ve la app: no puede leer el resto de tus archivos. Si cambiás de celular, te
            conectás y recuperás todo.
          </Muted>
          <Button
            label="Conectar con Google"
            icon={<Cloud color={c.primaryForeground} size={18} />}
            loading={connect.isPending}
            onPress={() => connect.mutate({})}
          />
        </>
      )}

      <ChoiceSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming ? `¿Restaurar el backup del ${when(confirming.createdAt)}?` : ''}
        description="Todos los datos de este celu se reemplazan por los del backup. Antes se guarda un backup de seguridad de lo que tenés ahora, y la app se reinicia."
        choices={[
          {
            label: 'Restaurar',
            variant: 'destructive',
            onPress: () => confirming && restore.mutate({ id: confirming.id }),
          },
        ]}
      />
      <ChoiceSheet
        open={offer !== null}
        onClose={() => setOffer(null)}
        title="Encontramos un backup en tu Drive"
        description={
          offer
            ? `Hay un backup de ${offer.deviceName === 'PC' ? 'tu PC' : 'otro celular'} del ${when(offer.createdAt)}. ¿Querés traer esos datos a este celu? Lo que tenés acá se reemplaza (antes se guarda un backup, por las dudas).`
            : undefined
        }
        choices={[
          {
            label: 'Restaurar',
            variant: 'primary',
            onPress: () => offer && restore.mutate({ id: offer.id }),
          },
          {
            label: 'No, seguir con estos datos',
            variant: 'outline',
            onPress: () => backupNow.mutate({}),
          },
        ]}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  title: { fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2.5),
    paddingHorizontal: space(2),
    borderRadius: radius.md,
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
})
