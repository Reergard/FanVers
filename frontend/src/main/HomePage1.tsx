import styles from "./HomePage.module.css";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";

export function HomePage1() {
  return (
    <div className={styles.section1}>
      <AdvertisingBooks />
    </div>
  );
}

export default HomePage1;