import type { Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";
import styles from "../styles/EditorToolbar.module.css";

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];
const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Palatino",
];

export function EditorToolbar({
  editor,
  onImageUpload,
}: {
  editor: Editor;
  /** Завантаження файлу зображення (глава вже існує або тимчасове сховище) */
  onImageUpload?: (file: File) => Promise<{ url: string }>;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const bgColorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL посилання:", previousUrl || "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    try {
      const parsed = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
        window.alert("Дозволені тільки http, https та mailto посилання");
        return;
      }
    } catch {
      window.alert("Невалідний URL");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImageByUrl = useCallback(() => {
    const url = window.prompt("URL зображення:");
    if (!url) return;

    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.protocol === "javascript:") return;
    } catch {
      // відносний шлях — ок
    }

    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f || !onImageUpload) return;

      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowed.includes(f.type)) {
        window.alert("Дозволені формати: JPEG, PNG, GIF, WebP");
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        window.alert("Макс. розмір — 5 МБ");
        return;
      }

      try {
        const { url } = await onImageUpload(f);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        window.alert("Помилка завантаження зображення");
      }
    },
    [editor, onImageUpload]
  );

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const headingValue = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : editor.isActive("heading", { level: 4 })
          ? "4"
          : editor.isActive("heading", { level: 5 })
            ? "5"
            : editor.isActive("heading", { level: 6 })
              ? "6"
              : "p";

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("bold") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Жирний (Ctrl+B)"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("italic") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Курсив (Ctrl+I)"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("underline") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Підкреслення (Ctrl+U)"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("strike") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Закреслення"
          >
            <s>S</s>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("superscript") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Верхній індекс"
          >
            X<sup>2</sup>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("subscript") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Нижній індекс"
          >
            X<sub>2</sub>
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <select
            className={styles.select}
            value={headingValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "p") {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = parseInt(val, 10) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
          >
            <option value="p">Параграф</option>
            <option value="1">Заголовок 1</option>
            <option value="2">Заголовок 2</option>
            <option value="3">Заголовок 3</option>
            <option value="4">Заголовок 4</option>
            <option value="5">Заголовок 5</option>
            <option value="6">Заголовок 6</option>
          </select>
        </div>

        <div className={styles.toolbarGroup}>
          <select
            className={styles.select}
            value={(editor.getAttributes("textStyle").fontSize as string) || ""}
            onChange={(e) => {
              const size = e.target.value;
              if (size) {
                editor.chain().focus().setFontSize(size).run();
              } else {
                editor.chain().focus().unsetFontSize().run();
              }
            }}
          >
            <option value="">Розмір</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {parseInt(size, 10)}pt
              </option>
            ))}
          </select>
        </div>

        <div className={styles.toolbarGroup}>
          <select
            className={styles.select}
            value={(editor.getAttributes("textStyle").fontFamily as string) || ""}
            onChange={(e) => {
              const font = e.target.value;
              if (font) {
                editor.chain().focus().setFontFamily(font).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
          >
            <option value="">Шрифт</option>
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => colorInputRef.current?.click()}
            title="Колір тексту"
          >
            <span
              style={{
                borderBottom: `3px solid ${(editor.getAttributes("textStyle").color as string) || "#000"}`,
              }}
            >
              A
            </span>
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className={styles.hiddenInput}
            value={(editor.getAttributes("textStyle").color as string) || "#000000"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />

          <button
            type="button"
            className={styles.btn}
            onClick={() => bgColorInputRef.current?.click()}
            title="Колір виділення"
          >
            <span
              style={{
                backgroundColor: (editor.getAttributes("highlight").color as string) || "#FFFF00",
                padding: "0 4px",
              }}
            >
              A
            </span>
          </button>
          <input
            ref={bgColorInputRef}
            type="color"
            className={styles.hiddenInput}
            value={(editor.getAttributes("highlight").color as string) || "#FFFF00"}
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive({ textAlign: "left" }) ? styles.active : ""}`}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="По лівому краю"
          >
            ≡←
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive({ textAlign: "center" }) ? styles.active : ""}`}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="По центру"
          >
            ≡↔
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive({ textAlign: "right" }) ? styles.active : ""}`}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="По правому краю"
          >
            →≡
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive({ textAlign: "justify" }) ? styles.active : ""}`}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            title="По ширині"
          >
            ≡≡
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("bulletList") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Маркований список"
          >
            • —
          </button>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("orderedList") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Нумерований список"
          >
            1. —
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("blockquote") ? styles.active : ""}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Цитата"
          >
            ❝
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Горизонтальна лінія"
          >
            ——
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.btn} ${editor.isActive("link") ? styles.active : ""}`}
            onClick={setLink}
            title="Посилання"
          >
            🔗
          </button>
          <button type="button" className={styles.btn} onClick={addImageByUrl} title="Зображення (URL)">
            🖼
          </button>
          {onImageUpload ? (
            <>
              <button
                type="button"
                className={styles.btn}
                onClick={() => imageInputRef.current?.click()}
                title="Завантажити зображення"
              >
                📁
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className={styles.hiddenInput}
                onChange={handleImageUpload}
                aria-hidden
              />
            </>
          ) : null}
          <button type="button" className={styles.btn} onClick={insertTable} title="Таблиця 3×3">
            ⊞
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Скасувати (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Повторити (Ctrl+Y)"
          >
            ↪
          </button>
        </div>
      </div>
    </div>
  );
}
