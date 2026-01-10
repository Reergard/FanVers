import styles from "./FrameLink.module.css";
import { NavLink } from "react-router-dom";

type Props = {
  to: string;
  children: React.ReactNode;
};

export function FrameLink({ to, children }: Props) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? `${styles.frameLink} ${styles.active}` : styles.frameLink
      }
    >
      <span className={styles.text}>{children}</span>
    </NavLink>
  );
}

