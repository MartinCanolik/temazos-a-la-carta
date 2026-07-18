import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'
import { Navbar } from '@/components/Navbar'

export function Home() {
  const navigate = useNavigate()

  return (
    <div className={styles.home}>
      {/* Gradiente superior para legibilidad del título */}
      <div className={styles.gradientTop} aria-hidden="true" />

      {/* Nav */}
      <Navbar home />

      <div className={styles.hero}>
        {/* Título */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>MÚSICA</h1>
          <p className={styles.titleSub}>A LA CARTA</p>
        </div>

        {/* Imagen de artistas — ancla al fondo de la pantalla */}
        <div className={styles.artistsWrap} aria-hidden="true">
          <img src="/homeimg.webp" alt="" className={styles.artistsImg} draggable={false} />
        </div>
      </div>
      {/* CTA */}
      <div className={styles.cta}>
        <button className="btn-outline" onClick={() => navigate('/repertorio')}>
          Ver repertorio
        </button>
      </div>
    </div>
  )
}
