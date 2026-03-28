import styles from "./HomePage.module.css";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";

export function HomePage1() {
  return (
    <section className={styles.page}>
      <div className={styles.homepage}>
        <div className={styles.section1}>
          <AdvertisingBooks />
        </div>
      </div>
    </section>
  );
}

export default HomePage1;