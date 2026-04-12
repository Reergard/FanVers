import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { FontSize } from "./extensions/FontSize";
import { EditorToolbar } from "./EditorToolbar";
import { useCallback, useEffect, useRef } from "react";
import styles from "../styles/ChapterEditor.module.css";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export interface ChapterEditorProps {
  initialContent: Record<string, unknown> | null;
  onContentChange: (json: Record<string, unknown>) => void;
  isSaving?: boolean;
  readOnly?: boolean;
  /** 0 — викликати onContentChange одразу (наприклад, при створенні глави) */
  contentChangeDebounceMs?: number;
  /** Завантаження зображення файлу (глава або тимчасове сховище) */
  onImageUpload?: (file: File) => Promise<{ url: string }>;
}

export function ChapterEditor({
  initialContent,
  onContentChange,
  isSaving = false,
  readOnly = false,
  contentChangeDebounceMs = 300,
  onImageUpload,
}: ChapterEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
      Placeholder.configure({
        placeholder: "Почніть писати главу...",
      }),
    ],
    content: (initialContent ?? EMPTY_DOC) as Record<string, unknown>,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as Record<string, unknown>;
      if (contentChangeDebounceMs <= 0) {
        onContentChange(json);
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onContentChange(json);
      }, contentChangeDebounceMs);
    },
  });

  useEffect(() => {
    if (editor && initialContent && !editor.isDestroyed) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(initialContent);
      if (currentJSON !== newJSON) {
        editor.commands.setContent(initialContent as Record<string, unknown>);
      }
    }
  }, [initialContent, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleImageDrop = useCallback(
    async (e: React.DragEvent) => {
      if (readOnly || !onImageUpload || !editor) return;
      const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();

      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      for (const file of files) {
        if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) continue;
        try {
          const { url } = await onImageUpload(file);
          editor.chain().focus().setImage({ src: url }).run();
        } catch {
          /* пропускаємо окремий файл */
        }
      }
    },
    [editor, onImageUpload, readOnly]
  );

  if (!editor) {
    return <div className={styles.editorLoading}>Завантаження редактора...</div>;
  }

  return (
    <div className={styles.editorWrapper}>
      {!readOnly && <EditorToolbar editor={editor} onImageUpload={onImageUpload} />}
      {isSaving && <div className={styles.savingIndicator}>Збереження...</div>}
      <div
        className={styles.editorContent}
        onDragOver={onImageUpload && !readOnly ? (ev) => ev.preventDefault() : undefined}
        onDrop={onImageUpload && !readOnly ? handleImageDrop : undefined}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
