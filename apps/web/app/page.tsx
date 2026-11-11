import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="page-title">
        <p className={styles.eyebrow}>Для ваших особенных событий</p>
        <h1 id="page-title" className={styles.title}>Повод</h1>
        <p className={styles.description}>
          Приглашения, с которых начинается праздник.
        </p>
        <p className={styles.detail}>
          Место, где история вашего события станет сайтом-приглашением
          для близких.
        </p>
        <p className={styles.notice}>
          Мы готовим сервис. Создание приглашений пока недоступно.
        </p>
      </section>
      <footer className={styles.footer}>Хорошему событию нужен повод.</footer>
    </main>
  );
}
