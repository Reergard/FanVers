import styles from "./MagicalGuide.module.css";
import { Container } from "../shared/Container";
import { PageTitle } from "../navigation/PageTitle";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";
import MagicalGuide1 from "./MagicalGuide1";
import MagicalGuide2 from "./MagicalGuide2";
import MagicalGuide3 from "./MagicalGuide3";

export function MagicalGuide() {
  return (
    <section className={styles.page}>
      <Container>
        <PageTitle>Чарівний гід</PageTitle>
        <div className={styles.homepage}>
          <AdvertisingBooks />
          <MagicalGuide1 />
          <MagicalGuide2 />
          <MagicalGuide3 />
        </div>
      </Container>
    </section>
  );
}

export default MagicalGuide;
