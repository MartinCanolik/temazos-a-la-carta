import { Navbar } from '@/components/Navbar'
import styles from './Donaciones.module.css'

const donationOptions = [
  {
    label: '1 cerveza',
    amount: '$200',
    href: 'https://mpago.la/1Q9zipd',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 8h8a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 6.5c0-1.1.9-2 2-2M11 5c0-1.1.9-2 2-2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: '2 cervezas',
    amount: '$500',
    href: 'https://mpago.la/1GcVY7U',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 8h6a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M15 9h1.25a2.75 2.75 0 0 1 0 5.5H15"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 7.5c.4-.7.95-1.1 1.6-1.3M12.8 6.5c.4-.7.95-1.1 1.6-1.3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M15.5 10.5l2-1.2M15.8 12l2.2-.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: '4 cervezas',
    amount: '$1.000',
    href: 'https://mpago.la/15cJJ6v',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 9h7a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 8.5h1.1a3 3 0 0 1 0 6H13.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 6.5c.25-.85.75-1.5 1.5-2M13.8 6.2c.25-.85.75-1.5 1.5-2M16.4 7.2c.25-.85.75-1.5 1.5-2"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          d="M15.8 11.5l2.5-.8M15.8 13l2.8.4M15.6 14.5l2.2 1.3"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export function Donaciones() {
  return (
    <div className={styles.page}>
      <div className={styles.gradientTop} aria-hidden="true" />
      <Navbar showBack />

      <main className={styles.content}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Gorra virtual</p>
          <h1 className={styles.title}>
            Dona una <span>cerveza</span> a los músicos
          </h1>
        </section>

        <section className={styles.options} aria-label="Opciones de donación">
          {donationOptions.map((option) => (
            <a
              key={option.label}
              className={styles.optionButton}
              href={option.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className={styles.optionIcon}>{option.icon}</span>
              <span className={styles.optionText}>
                <strong>{option.label}</strong>
                <span>{option.amount}</span>
              </span>
            </a>
          ))}
        </section>

        <div className={styles.cta}>
          <a
            className="btn-outline"
            href="https://link.mercadopago.com.uy/lucilamusica"
            target="_blank"
            rel="noreferrer"
          >
            Elegí un precio
          </a>
        </div>
      </main>
    </div>
  )
}
