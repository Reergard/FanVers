import styles from "./Container.module.css";

type Props = {
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "footer";
  className?: string;
};

export function Container({ children, as = "div", className }: Props) {
  const Tag = as;
  return <Tag className={[styles.container, className].filter(Boolean).join(" ")}>{children}</Tag>;
}
