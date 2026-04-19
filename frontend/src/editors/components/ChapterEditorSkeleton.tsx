import styles from "../styles/ChapterEditor.module.css";

/** Плейсхолдер, поки підвантажується асинхронний чанк з Tiptap.
 *  min-height: 400 — співпадає з .editorContent реального редактора,
 *  щоб при заміні скелетона не було стрибка верстки (CLS). */
export function ChapterEditorSkeleton() {
  return (
    <div
      className={styles.editorWrapper}
      aria-busy="true"
      aria-label="Завантаження редактора..."
      style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className={styles.editorLoading}>Завантаження редактора...</div>
    </div>
  );
}
