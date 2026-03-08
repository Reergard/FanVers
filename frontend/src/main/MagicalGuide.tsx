import styles from "./HomePage.module.css";
import { Container } from "../shared/Container";
import { PageTitle } from "../navigation/PageTitle";
import MagicalGuide1 from "./MagicalGuide1";
import MagicalGuide2 from "./MagicalGuide2";

export function MagicalGuide() {
  return (
    <section className={styles.page}>
      <Container>
        <PageTitle>Чарівний гід</PageTitle>
        <div className={styles.homepage}>
          <MagicalGuide1 />
          <MagicalGuide2 />
        </div>
      </Container>
    </section>
  );
}

export default MagicalGuide;
