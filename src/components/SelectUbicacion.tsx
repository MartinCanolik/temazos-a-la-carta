import type { OpcionUbicacion } from '@/lib/agenda'
import styles from '@/pages/panel/panel.module.css'

interface SelectUbicacionProps {
  opciones: OpcionUbicacion[]
  valor: string
  onChange: (valor: string) => void
}

/** City / zone filter shared by the public agenda and the rankings. Hidden when there is nothing to choose. */
export function SelectUbicacion({ opciones, valor, onChange }: SelectUbicacionProps) {
  if (opciones.length <= 1) return null
  return (
    <select
      className={styles.select}
      aria-label="Ciudad o zona"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  )
}
