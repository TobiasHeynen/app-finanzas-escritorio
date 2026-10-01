import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '@renderer/app/theme'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'

export function AppearanceSection() {
  const { preference, setPreference } = useTheme()
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Apariencia</h2>
        <p className="text-sm text-muted-foreground">Por defecto sigue el tema de Windows.</p>
      </div>
      <ToggleGroup
        type="single"
        value={preference}
        onValueChange={(v) => v && setPreference(v as ThemePreference)}
        aria-label="Tema"
      >
        <ToggleGroupItem value="system">
          <Monitor /> Sistema
        </ToggleGroupItem>
        <ToggleGroupItem value="light">
          <Sun /> Claro
        </ToggleGroupItem>
        <ToggleGroupItem value="dark">
          <Moon /> Oscuro
        </ToggleGroupItem>
      </ToggleGroup>
    </section>
  )
}
