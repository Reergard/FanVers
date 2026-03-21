import styles from "./HomePage.module.css";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";
import { Container } from "../shared/Container";

export function HomePage1() {
  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.homepage}>
          <div className={styles.section1}>
            <AdvertisingBooks />
          </div>
        </div>
      </Container>
    </section>
  );
}

export default HomePage1;