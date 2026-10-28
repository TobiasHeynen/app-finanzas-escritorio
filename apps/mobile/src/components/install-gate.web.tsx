import { useState, type ReactNode } from 'react'
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Share, SquarePlus, Smartphone } from 'lucide-react-native'
import { Button, Card, Muted } from '@/components/ui'
import { radius, space, useColors } from '@/lib/theme'

const PLAY_URL = 'https://play.google.com/store/apps/details?id=ar.tobiasheynen.chanchito'
const STORE_URL = 'https://apps.microsoft.com/search?query=Chanchito'
const SKIP_KEY = 'chanchito:usar-sin-instalar'

type Device = 'iphone' | 'iphone-otro-navegador' | 'android' | 'pc'

function detectDevice(): Device {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'iphone-otro-navegador' : 'iphone'
  if (/Android/.test(ua)) return 'android'
  return 'pc'
}

function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || window.matchMedia('(display-mode: standalone)').matches
}

function skipped(): boolean {
  // La vista previa y los e2e corren en la máquina local: ahí no se pide instalar.
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return true
  try {
    return localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Versión web (pensada para iPhone): abierta en Safari sin instalar, iOS puede borrar los datos si no se
 * usa por unos días, y lo que se cargue ahí no aparece en la instalada. Por eso antes de arrancar se
 * explica cómo instalarla; en Android y en la PC se recomienda la app de la tienda.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const [pass, setPass] = useState(() => isInstalled() || skipped())
  if (pass) return children

  const useAnyway = () => {
    try {
      localStorage.setItem(SKIP_KEY, '1')
    } catch {
      // Sin localStorage se vuelve a mostrar la próxima vez: no pasa nada.
    }
    setPass(true)
  }
  return <InstallScreen device={detectDevice()} onUseAnyway={useAnyway} />
}

function InstallScreen({ device, onUseAnyway }: { device: Device; onUseAnyway: () => void }) {
  const c = useColors()
  const iphone = device === 'iphone' || device === 'iphone-otro-navegador'
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.content}
      testID="install-gate"
    >
      <View style={styles.header}>
        <Image source={{ uri: '/icons/apple-touch-icon.png' }} style={styles.icon} />
        <Text style={[styles.title, { color: c.foreground }]}>
          {iphone ? 'Instalá Chanchito en tu iPhone' : 'Chanchito para iPhone'}
        </Text>
      </View>

      {device === 'iphone' ? (
        <Card style={{ gap: space(4) }}>
          <Step n={1} icon={<Share color={c.primary} size={20} />}>
            Tocá <Text style={styles.strong}>Compartir</Text> en la barra de Safari.
          </Step>
          <Step n={2} icon={<SquarePlus color={c.primary} size={20} />}>
            Elegí <Text style={styles.strong}>Agregar a inicio</Text> (si no lo ves, deslizá hacia
            abajo) y tocá <Text style={styles.strong}>Agregar</Text>.
          </Step>
          <Step n={3} icon={<Smartphone color={c.primary} size={20} />}>
            Abrí Chanchito desde el ícono nuevo de la pantalla de inicio.
          </Step>
        </Card>
      ) : device === 'iphone-otro-navegador' ? (
        <Card>
          <Text style={[styles.text, { color: c.foreground }]}>
            Abrí <Text style={styles.strong}>app.chanchitoapp.com.ar</Text> en{' '}
            <Text style={styles.strong}>Safari</Text> y desde ahí agregala a la pantalla de inicio.
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: space(3) }}>
          <Text style={[styles.text, { color: c.foreground }]}>
            Esta es la versión para iPhone.{' '}
            {device === 'android'
              ? 'En Android te conviene la app de Google Play: es la misma y con backup automático.'
              : 'En Windows te conviene la app de Microsoft Store: es la misma y guarda los datos en tu PC.'}
          </Text>
          <Button
            label={device === 'android' ? 'Abrir Google Play' : 'Abrir Microsoft Store'}
            onPress={() => void Linking.openURL(device === 'android' ? PLAY_URL : STORE_URL)}
          />
        </Card>
      )}

      <Muted>
        Tus datos quedan sólo en este dispositivo: no hay cuentas ni servidores.
        {iphone
          ? ' Usada desde Safari sin instalar, iOS puede borrarlos si pasan unos días sin abrirla, y no pasan a la app instalada.'
          : ''}
      </Muted>
      <Button label="Usarla igual en el navegador" variant="ghost" onPress={onUseAnyway} />
    </ScrollView>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  const c = useColors()
  return (
    <View style={styles.step}>
      <View style={[styles.badge, { backgroundColor: c.accent }]}>
        <Text style={{ color: c.foreground, fontWeight: '600' }}>{n}</Text>
      </View>
      <Text style={[styles.text, { color: c.foreground, flex: 1 }]}>{children}</Text>
      {icon}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: space(5),
    paddingTop: space(12),
    gap: space(5),
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', gap: space(3) },
  icon: { width: 72, height: 72, borderRadius: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 22 },
  strong: { fontWeight: '600' },
  step: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
