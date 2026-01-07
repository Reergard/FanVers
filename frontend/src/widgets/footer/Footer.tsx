import styles from "./Footer.module.css";
import { Container } from "../../shared/Container";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <p>© 2026 FanVers. Всі права захищені.</p>
      </Container>
    </footer>
  );
}