import styles from "./Base.module.css";
import { Header } from "../widgets/header/Header";
import { Footer } from "../widgets/footer/Footer";
import { SvgSprite } from "../shared/SvgSprite";
import { ScrollIndicator } from "../shared/ScrollIndicator/ScrollIndicator";

type Props = { children: React.ReactNode };
export function Base({ children }: Props) {
  return (
    <div className={styles.app}>
      <SvgSprite />
      <ScrollIndicator />
      <div className={styles.bg} aria-hidden="true" />
      <Header />
      <main className={styles.main} role="main">
          {children}
      </main>
      <Footer />
    </div>
  );
}
