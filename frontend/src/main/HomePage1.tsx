import styles from "./HomePage.module.css";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";
import Home2 from "./HomePage2";
import Home3 from "./HomePage3";
import { Container } from "../shared/Container";

export function HomePage1() {
  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.homepage}>
          <div className={styles.section1}>
            <AdvertisingBooks />
          </div>
          <Home2 />
          <Home3 />
        </div>
      </Container>
    </section>
  );
}

export default HomePage1;