import { Link } from "react-router-dom";
import styles from "./Breadcrumb.module.css";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav className={styles.breadcrumb} aria-label="breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const crumb = isLast ? (
          <span className={styles.crumb} aria-current="page">
            {item.label}
          </span>
        ) : item.to ? (
          <Link className={styles.crumb} to={item.to}>
            {item.label}
          </Link>
        ) : (
          <span className={styles.crumb}>{item.label}</span>
        );

        return (
          <span key={index} className={styles.item}>
            {index > 0 && <span className={styles.sep} aria-hidden>›</span>}
            {crumb}
          </span>
        );
      })}
    </nav>
  );
}
