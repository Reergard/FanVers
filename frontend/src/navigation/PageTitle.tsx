import styles from "./PageTitle.module.css";

type PageTitleProps = {
  children: React.ReactNode;
  /** Додатковий клас для перевизначення стилів */
  className?: string;
};

export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1 className={className ? `${styles.title} ${className}` : styles.title}>
      {children}
    </h1>
  );
}
