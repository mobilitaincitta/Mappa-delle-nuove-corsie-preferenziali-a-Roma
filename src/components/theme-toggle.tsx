import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ scuro, onAlterna }: { scuro: boolean; onAlterna: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onAlterna}
      className="size-9 shrink-0"
      aria-label={scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      title={scuro ? 'Tema chiaro' : 'Tema scuro'}
    >
      {scuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
