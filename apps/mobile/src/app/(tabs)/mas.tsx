import { View } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import {
  ChartColumn,
  CreditCard,
  DatabaseBackup,
  FileSpreadsheet,
  Repeat,
  Shapes,
} from 'lucide-react-native'
import { ListItem } from '@/components/list-item'
import { Screen } from '@/components/screen'
import { Muted, SectionTitle } from '@/components/ui'
import { space, useColors } from '@/lib/theme'

export default function MasScreen() {
  const c = useColors()
  const icon = (Icon: typeof Repeat) => <Icon color={c.primary} size={22} />
  return (
    <Screen title="Más">
      <View style={{ gap: space(2) }}>
        <SectionTitle>Configuración</SectionTitle>
        <ListItem
          icon={icon(Repeat)}
          title="Gastos fijos"
          subtitle="Alquiler, servicios y lo que se repite todos los meses"
          onPress={() => router.push('/config/recurrentes')}
        />
        <ListItem
          icon={icon(Shapes)}
          title="Categorías"
          subtitle="Qué compraste: categorías y subcategorías"
          onPress={() => router.push('/config/categorias')}
        />
        <ListItem
          icon={icon(CreditCard)}
          title="Medios de pago y tarjetas"
          subtitle="Cómo pagaste; día de cierre de cada tarjeta"
          onPress={() => router.push('/config/medios')}
        />
      </View>
      <View style={{ gap: space(2) }}>
        <SectionTitle>Datos</SectionTitle>
        <ListItem
          icon={icon(ChartColumn)}
          title="Reporte anual"
          subtitle="Llega en la fase 6"
          muted
        />
        <ListItem
          icon={icon(FileSpreadsheet)}
          title="Exportar a Excel / CSV"
          subtitle="Llega en la fase 6"
          muted
        />
        <ListItem
          icon={icon(DatabaseBackup)}
          title="Backups y pasar datos"
          subtitle="Llega en la fase 7"
          muted
        />
      </View>
      <Muted style={{ textAlign: 'center' }}>
        Chanchito {Constants.expoConfig?.version ?? ''} · 100% local, sin cuentas
      </Muted>
    </Screen>
  )
}
