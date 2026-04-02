import styles from "./Base.module.css";
import { Header } from "../widgets/header/Header";
import { Footer } from "../widgets/footer/Footer";
import { SvgSprite } from "../shared/SvgSprite";
import { ScrollIndicator } from "../shared/ScrollIndicator/ScrollIndicator";
import { useLocation } from "react-router-dom";
import { CookieConsentManager } from "../widgets/cookieConsent/CookieConsentManager";

type Props = { children: React.ReactNode };
export function Base({ children }: Props) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className={styles.app}>
      <SvgSprite />
      <ScrollIndicator />
      <div className={styles.bg} aria-hidden="true" />
      <Header />
      <main className={[styles.main, isHome && styles.mainHome].filter(Boolean).join(" ")} role="main">
          {children}
      </main>
      <CookieConsentManager />
      <Footer />
    </div>
  );
}
