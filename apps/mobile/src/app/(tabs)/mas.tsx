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
  Users,
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
        <ListItem
          icon={icon(Users)}
          title="Grupos"
          subtitle="Gastos compartidos: quién pagó cada cosa"
          onPress={() => router.push('/config/grupos')}
        />
      </View>
      <View style={{ gap: space(2) }}>
        <SectionTitle>Datos</SectionTitle>
        <ListItem
          icon={icon(ChartColumn)}
          title="Reporte anual"
          subtitle="En qué se fue la plata, mes a mes"
          onPress={() => router.push('/reporte')}
        />
        <ListItem
          icon={icon(FileSpreadsheet)}
          title="Exportar a Excel / CSV"
          subtitle="Un mes o un año, para compartir o guardar"
          onPress={() => router.push('/exportar')}
        />
        <ListItem
          icon={icon(DatabaseBackup)}
          title="Backups y pasar datos"
          subtitle="Backups, y llevar tus datos entre la PC y el celu"
          onPress={() => router.push('/backups')}
        />
      </View>
      <Muted style={{ textAlign: 'center' }}>
        Chanchito {Constants.expoConfig?.version ?? ''} · 100% local, sin cuentas
      </Muted>
    </Screen>
  )
}
