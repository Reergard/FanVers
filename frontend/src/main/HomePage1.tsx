import styles from "./HomePage.module.css";
import { AdvertisingBooks } from "../website_advertising/AdvertisingBooks";
import MagicalGuide1 from "./MagicalGuide1";
import MagicalGuide2 from "./MagicalGuide2";

export function HomePage1() {
  return (
    <div className={styles.section1}>
      <AdvertisingBooks />
      <MagicalGuide1 />
      <MagicalGuide2 />
    </div>
  );
}

export default HomePage1;