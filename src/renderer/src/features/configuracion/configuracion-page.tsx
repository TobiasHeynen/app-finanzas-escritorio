import { useSearchParams } from 'react-router'
import { Page, PageHeader } from '@renderer/components/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { AppearanceSection } from './appearance-section'
import { BackupsSection } from './backups-section'
import { CategoriesSection } from './categories-section'
import { PaymentMethodsSection } from './payment-methods-section'
import { RecurringSection } from './recurring-section'

const TABS = ['categorias', 'medios', 'recurrentes', 'backups', 'apariencia'] as const

export function ConfiguracionPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'categorias'
  return (
    <Page>
      <PageHeader title="Configuración" />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="medios">Medios de pago</TabsTrigger>
          <TabsTrigger value="recurrentes">Recurrentes</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias">
          <CategoriesSection />
        </TabsContent>
        <TabsContent value="medios">
          <PaymentMethodsSection />
        </TabsContent>
        <TabsContent value="recurrentes">
          <RecurringSection />
        </TabsContent>
        <TabsContent value="backups">
          <BackupsSection />
        </TabsContent>
        <TabsContent value="apariencia">
          <AppearanceSection />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
