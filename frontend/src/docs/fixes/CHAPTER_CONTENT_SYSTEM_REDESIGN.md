# Редизайн системы глав: от .docx + mammoth к content_json

## Общая картина (простыми словами)

### Что сейчас не так

Сейчас когда автор загружает файл `.docx` с главой, мы конвертируем его в HTML через библиотеку **mammoth**. Mammoth — это инструмент, который был создан для *структурного* преобразования документов (заголовки, абзацы, списки), но он **намеренно выбрасывает визуальное оформление**: цвета текста, размеры шрифтов, конкретные шрифты, выравнивание, отступы и т.д. Если автор оформил свой текст с красным заголовком, курсивным эпиграфом и разными размерами шрифтов — читатель увидит "серый одинаковый текст".

Кроме того, система хранения запутана: docx-файл лежит на диске, HTML хранится одновременно и в базе данных, и в файле на диске — два кэша, которые могут рассинхронизироваться. При замене файла главы (через "Редактировать") HTML вообще не пересоздается — читатель видит старый контент.

### Что хотим получить

1. **Стили сохраняются** — жирный, курсив, цвета, размеры шрифтов, выравнивание, ссылки, изображения — всё что автор вложил в документ, читатель видит на сайте.
2. **Один источник правды** — не "docx или html", а структурированный JSON-документ (`content_json`), из которого генерируются все производные форматы.
3. **Готовность к редактору на сайте** — тот же `content_json` может редактироваться через WYSIWYG-редактор (Tiptap/ProseMirror) прямо на странице, без загрузки файлов.
4. **Надёжность** — нет двойного кэша, нет рассинхронизации, нет "старого HTML после обновления docx".
5. **Профессиональная архитектура** — автосохранение, история версий, черновики, поиск по тексту — всё строится на `content_json`.

### Как будем менять

Вместо цепочки `.docx → mammoth → HTML` делаем:

```
.docx → python-docx (парсинг) → content_json (источник правды)
                                       ↓
                              rendered_html (для чтения)
                              plain_text (для поиска)
                              toc_data (для навигации)
```

А в будущем:

```
WYSIWYG-редактор на сайте → content_json (тот же формат)
                                   ↓
                          rendered_html / plain_text / toc_data
```

---

## Текущая архитектура: подробный разбор проблем

### 1. Модель Chapter (backend/apps/catalog/models.py:447-597)

**Текущие поля хранения контента:**

| Поле | Тип | Назначение | Проблема |
|------|-----|-----------|----------|
| `file` | `FileField` | Исходный .docx | Хранит файл, но формат непригоден для отображения напрямую |
| `html_content` | `TextField` | HTML в БД (кэш) | Кэш #1 — может быть устаревшим после замены файла |
| `html_file_path` | `CharField` | Путь к HTML-файлу на диске | Кэш #2 — дублирует html_content, дополнительная точка отказа |
| `character_count` | `IntegerField` | Кол-во символов | Считается по `len(html_content)` — это длина HTML с тегами, а не текста |
| `characters_count` | `IntegerField` | Дубль character_count | Дублирование поля "для совместимости" |

**Проблема двойного кэша — `get_html_content()` (models.py:561-588):**

```
1. Если html_content в БД → вернуть
2. Если html_file_path → прочитать файл → записать в html_content → вернуть
3. Если ничего нет → return None
```

Два кэша (БД + файл) — это два источника, которые могут рассинхронизироваться. Файл может быть удалён, а в БД останется старый контент, или наоборот.

**Проблема подсчёта символов — `save()` (models.py:514-535):**

```python
if self.html_content:
    self.character_count = len(self.html_content)  # <-- считает HTML-теги!
```

`len('<p><strong>Привіт</strong></p>')` = 31, а реальных символов текста = 6.

### 2. Конвертация mammoth: потеря стилей

**Где вызывается mammoth (все точки):**

| Файл | Строки | Контекст |
|------|--------|----------|
| `catalog/api/views.py` | 317-324 | `add_chapter()` — при создании главы |
| `catalog/api/views.py` | 206-215 | `chapter_detail()` — ленивая генерация при чтении |
| `catalog/management/commands/generate_html_content.py` | 31-34 | Management-команда для пакетной генерации |
| `main/api/views.py` | 211, 263, 315, 367, 419, 471 | Множественные точки в main app |

**Все вызовы одинаковые:**
```python
result = mammoth.convert_to_html(docx_file)
html_content = result.value
```

Без каких-либо `style_map` или настроек. Mammoth по умолчанию:
- **Сохраняет**: `<strong>`, `<em>`, `<h1>`-`<h6>`, `<p>`, `<ul>`/`<ol>`, `<a>`, `<img>`, `<table>`
- **Выбрасывает**: font-size, font-family, color, background-color, text-align, line-height, margin, padding, text-indent, все inline-стили

**Пример потери:**

Исходный docx:
```
Заголовок (красный, 18pt, по центру)
Обычный текст (чёрный, 12pt)
Курсивный эпиграф (серый, 10pt, italic)
```

Результат mammoth:
```html
<p>Заголовок</p>
<p>Обычный текст</p>
<p><em>Курсивный эпиграф</em></p>
```

Все цвета, размеры, выравнивание — потеряны. Это by design: mammoth считает, что стилизация — ответственность CSS, а не документа.

### 3. Проблема update_chapter (editors/api/views.py:29-90)

**Критический баг:** при замене `.docx` файла HTML **не пересоздаётся**.

```python
if 'file' in request.FILES:
    if old_file:
        if os.path.isfile(old_file.path):
            os.remove(old_file.path)
    chapter.file = request.FILES['file']

chapter.save()  # <-- НЕ очищает html_content, НЕ вызывает конвертацию
```

Результат: автор загрузил новый docx, но читатели видят **старый** HTML из кэша (`html_content` в БД), пока кто-то вручную не очистит кэш.

### 4. Отсутствие единого источника правды

Текущая "цепочка правды":

```
docx (файл) → [mammoth] → html_content (БД) ← → html_file (диск)
     ↑                            ↑
  "первичный"              "кэш, но de facto используется как основной"
```

Проблемы:
- docx нельзя редактировать на сайте
- HTML нельзя надёжно парсить обратно в редактируемую структуру
- Нет возможности делать diff, версионирование, автосохранение
- Нет возможности строить оглавление, извлекать plain text для поиска

---

## Целевая архитектура: content_json как источник правды

### 1. Новая структура модели Chapter

**Новые поля (добавляются):**

```python
class Chapter(models.Model):
    # --- Существующие поля (оставляем) ---
    title = models.CharField(max_length=255)
    book = models.ForeignKey(Book, ...)
    volume = models.ForeignKey(Volume, ...)
    slug = models.SlugField(...)
    is_paid = models.BooleanField(default=False)
    price = models.DecimalField(...)
    order = models.PositiveIntegerField(...)
    created_at = models.DateTimeField(...)
    updated_at = models.DateTimeField(...)
    reading_time = models.IntegerField(default=0)
    min_reading_time = models.IntegerField(default=0)

    # --- НОВЫЙ источник правды ---
    content_json = models.JSONField(
        null=True, blank=True,
        verbose_name='Структурований контент (JSON)'
    )
    content_version = models.PositiveIntegerField(
        default=1,
        verbose_name='Версія контенту'
    )

    # --- Производные (генерируются из content_json) ---
    rendered_html = models.TextField(
        blank=True, null=True,
        verbose_name='HTML для відображення'
    )
    plain_text = models.TextField(
        blank=True, null=True,
        verbose_name='Чистий текст для пошуку'
    )
    plain_text_length = models.IntegerField(
        default=0,
        verbose_name='Кількість символів тексту'
    )
    toc_json = models.JSONField(
        null=True, blank=True,
        verbose_name='Зміст (заголовки)'
    )

    # --- Исходники (для импорта/экспорта) ---
    original_file = models.FileField(
        upload_to=chapter_directory_path,
        blank=True, null=True,
        verbose_name='Оригінальний завантажений файл'
    )
    original_file_type = models.CharField(
        max_length=20, blank=True, default='',
        verbose_name='Тип оригінального файлу'
    )

    # --- Поля для удаления после миграции ---
    # file — заменяется на original_file
    # html_content — заменяется на rendered_html
    # html_file_path — удаляется полностью (не нужен)
    # character_count — заменяется на plain_text_length
    # characters_count — удаляется (дубль)
```

### 2. Формат content_json (ProseMirror-совместимый)

Формат выбран для совместимости с **Tiptap/ProseMirror** — стандартом WYSIWYG-редакторов для веба. Это значит, что `content_json`, созданный из docx, можно будет открыть в редакторе на сайте без конвертации.

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1, "textAlign": "center" },
      "content": [
        {
          "type": "text",
          "text": "Назва розділу",
          "marks": [
            { "type": "textStyle", "attrs": { "color": "#cc0000", "fontSize": "24px" } }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "attrs": { "textAlign": "left" },
      "content": [
        {
          "type": "text",
          "text": "Звичайний текст абзацу. "
        },
        {
          "type": "text",
          "text": "Жирний фрагмент",
          "marks": [
            { "type": "bold" }
          ]
        },
        {
          "type": "text",
          "text": " і ",
        },
        {
          "type": "text",
          "text": "курсивний кольоровий",
          "marks": [
            { "type": "italic" },
            { "type": "textStyle", "attrs": { "color": "#666666" } }
          ]
        },
        {
          "type": "text",
          "text": "."
        }
      ]
    },
    {
      "type": "paragraph",
      "attrs": { "textAlign": "right" },
      "content": [
        {
          "type": "text",
          "text": "Текст по правому краю",
          "marks": [
            { "type": "textStyle", "attrs": { "fontSize": "10px" } }
          ]
        }
      ]
    },
    {
      "type": "image",
      "attrs": {
        "src": "/media/books/my-book/chapters/images/img1.png",
        "alt": "Опис зображення",
        "width": 600
      }
    },
    {
      "type": "blockquote",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Цитата з книги" }
          ]
        }
      ]
    },
    {
      "type": "horizontalRule"
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "Пункт списку" }]
            }
          ]
        }
      ]
    }
  ]
}
```

**Поддерживаемые типы узлов (nodes):**

| Тип | Атрибуты | Описание |
|-----|----------|----------|
| `doc` | — | Корневой узел |
| `paragraph` | `textAlign` | Абзац |
| `heading` | `level` (1-6), `textAlign` | Заголовок |
| `blockquote` | — | Цитата |
| `bulletList` | — | Маркированный список |
| `orderedList` | `start` | Нумерованный список |
| `listItem` | — | Элемент списка |
| `image` | `src`, `alt`, `title`, `width`, `height` | Изображение |
| `horizontalRule` | — | Горизонтальная линия |
| `table` | — | Таблица |
| `tableRow` | — | Строка таблицы |
| `tableCell` | `colspan`, `rowspan`, `colwidth` | Ячейка таблицы |
| `hardBreak` | — | Принудительный перенос строки |

**Поддерживаемые marks (инлайн-стили):**

| Mark | Атрибуты | Описание |
|------|----------|----------|
| `bold` | — | Жирный |
| `italic` | — | Курсив |
| `underline` | — | Подчёркивание |
| `strike` | — | Зачёркивание |
| `textStyle` | `color`, `fontSize`, `fontFamily`, `backgroundColor` | Inline-стили текста |
| `link` | `href`, `target`, `rel` | Ссылка |
| `superscript` | — | Надстрочный |
| `subscript` | — | Подстрочный |
| `highlight` | `color` | Выделение фоном |

### 3. Конвертация docx → content_json (замена mammoth)

**Инструмент:** `python-docx` (уже умеет парсить .docx на уровне параграфов, runs, стилей).

**Новый модуль:** `backend/apps/catalog/services/docx_to_json.py`

```
docx
 └── paragraphs[]
      └── runs[]  (фрагменты текста с одинаковым форматированием)
           ├── text
           ├── bold / italic / underline / strike
           ├── font.color.rgb → color
           ├── font.size → fontSize
           ├── font.name → fontFamily
           └── font.highlight_color → highlight
      └── paragraph_format
           ├── alignment → textAlign
           └── style.name → heading level / blockquote detection
```

**Алгоритм конвертации (псевдокод):**

```python
def docx_to_content_json(docx_path: str) -> dict:
    doc = Document(docx_path)
    nodes = []

    for para in doc.paragraphs:
        # 1. Определяем тип узла
        node_type = detect_node_type(para)  # paragraph / heading / blockquote
        attrs = extract_paragraph_attrs(para)  # textAlign, heading level

        # 2. Собираем content из runs
        text_nodes = []
        for run in para.runs:
            marks = extract_marks(run)  # bold, italic, textStyle{color, fontSize}
            text_node = {"type": "text", "text": run.text}
            if marks:
                text_node["marks"] = marks
            text_nodes.append(text_node)

        # 3. Собираем узел
        node = {"type": node_type}
        if attrs:
            node["attrs"] = attrs
        if text_nodes:
            node["content"] = text_nodes
        nodes.append(node)

    # 4. Обрабатываем списки (группировка последовательных list-paragraphs)
    nodes = group_list_items(nodes)

    # 5. Обрабатываем таблицы
    for table in doc.tables:
        nodes.append(table_to_node(table))

    # 6. Обрабатываем изображения
    #    python-docx даёт доступ к embedded images через relationships
    nodes = process_inline_images(doc, nodes, media_dir)

    return {"type": "doc", "content": nodes}
```

**Извлечение marks из run:**

```python
def extract_marks(run) -> list:
    marks = []

    if run.bold:
        marks.append({"type": "bold"})
    if run.italic:
        marks.append({"type": "italic"})
    if run.underline:
        marks.append({"type": "underline"})
    if run.font.strike:
        marks.append({"type": "strike"})

    # textStyle — собирает inline-стили
    style_attrs = {}
    if run.font.color and run.font.color.rgb:
        style_attrs["color"] = f"#{run.font.color.rgb}"
    if run.font.size:
        style_attrs["fontSize"] = f"{run.font.size.pt}px"
    if run.font.name:
        style_attrs["fontFamily"] = run.font.name
    if run.font.highlight_color:
        marks.append({"type": "highlight", "attrs": {"color": map_highlight(run.font.highlight_color)}})

    if style_attrs:
        marks.append({"type": "textStyle", "attrs": style_attrs})

    return marks
```

**Извлечение атрибутов параграфа:**

```python
from docx.enum.text import WD_ALIGN_PARAGRAPH

ALIGN_MAP = {
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
}

def extract_paragraph_attrs(para) -> dict:
    attrs = {}
    if para.alignment and para.alignment in ALIGN_MAP:
        attrs["textAlign"] = ALIGN_MAP[para.alignment]
    return attrs

def detect_node_type(para) -> tuple:
    style_name = (para.style.name or "").lower()
    if style_name.startswith("heading"):
        level = int(style_name.replace("heading", "").strip()) if style_name[-1].isdigit() else 1
        return "heading", {"level": min(level, 6)}
    if style_name in ("quote", "block quote", "intense quote"):
        return "blockquote", {}
    if style_name.startswith("list"):
        return "listItem", {}
    return "paragraph", {}
```

### 4. Рендеринг content_json → rendered_html

**Новый модуль:** `backend/apps/catalog/services/json_to_html.py`

Преобразует ProseMirror JSON → чистый HTML с inline-стилями.

```python
def render_node(node: dict) -> str:
    node_type = node.get("type")
    attrs = node.get("attrs", {})
    content = node.get("content", [])
    marks = node.get("marks", [])

    if node_type == "doc":
        return "".join(render_node(child) for child in content)

    if node_type == "text":
        html = escape(node.get("text", ""))
        # Оборачиваем в marks (от внутренних к внешним)
        for mark in reversed(marks):
            html = wrap_mark(html, mark)
        return html

    if node_type == "paragraph":
        style = build_block_style(attrs)
        inner = "".join(render_node(c) for c in content)
        return f'<p{style}>{inner}</p>'

    if node_type == "heading":
        level = attrs.get("level", 1)
        style = build_block_style(attrs)
        inner = "".join(render_node(c) for c in content)
        return f'<h{level}{style}>{inner}</h{level}>'

    if node_type == "blockquote":
        inner = "".join(render_node(c) for c in content)
        return f'<blockquote>{inner}</blockquote>'

    if node_type == "image":
        src = escape(attrs.get("src", ""))
        alt = escape(attrs.get("alt", ""))
        width = attrs.get("width")
        w = f' width="{width}"' if width else ""
        return f'<img src="{src}" alt="{alt}"{w} />'

    if node_type == "horizontalRule":
        return "<hr />"

    if node_type == "hardBreak":
        return "<br />"

    # bulletList, orderedList, listItem, table, tableRow, tableCell
    # ... аналогично

def wrap_mark(html: str, mark: dict) -> str:
    mark_type = mark.get("type")
    attrs = mark.get("attrs", {})

    if mark_type == "bold":
        return f"<strong>{html}</strong>"
    if mark_type == "italic":
        return f"<em>{html}</em>"
    if mark_type == "underline":
        return f'<span style="text-decoration:underline">{html}</span>'
    if mark_type == "strike":
        return f"<s>{html}</s>"
    if mark_type == "link":
        href = escape(attrs.get("href", ""))
        return f'<a href="{href}" rel="noopener noreferrer">{html}</a>'
    if mark_type == "textStyle":
        parts = []
        if attrs.get("color"):
            parts.append(f"color:{attrs['color']}")
        if attrs.get("fontSize"):
            parts.append(f"font-size:{attrs['fontSize']}")
        if attrs.get("fontFamily"):
            parts.append(f"font-family:{attrs['fontFamily']}")
        if attrs.get("backgroundColor"):
            parts.append(f"background-color:{attrs['backgroundColor']}")
        style = ";".join(parts)
        return f'<span style="{style}">{html}</span>' if style else html
    if mark_type == "highlight":
        color = attrs.get("color", "yellow")
        return f'<mark style="background-color:{color}">{html}</mark>'

    return html

def build_block_style(attrs: dict) -> str:
    parts = []
    if attrs.get("textAlign") and attrs["textAlign"] != "left":
        parts.append(f"text-align:{attrs['textAlign']}")
    if not parts:
        return ""
    return f' style="{";".join(parts)}"'
```

### 5. Извлечение plain_text и toc_json

```python
def extract_plain_text(content_json: dict) -> str:
    """Рекурсивно извлекает весь текст из content_json."""
    if content_json.get("type") == "text":
        return content_json.get("text", "")
    parts = []
    for child in content_json.get("content", []):
        parts.append(extract_plain_text(child))
    return "".join(parts)


def extract_toc(content_json: dict) -> list:
    """Извлекает заголовки для навигационного оглавления."""
    toc = []
    for node in content_json.get("content", []):
        if node.get("type") == "heading":
            level = node.get("attrs", {}).get("level", 1)
            text = extract_plain_text(node)
            toc.append({"level": level, "text": text})
    return toc
```

### 6. Новый метод Chapter.rebuild_derived()

Единая точка перегенерации всех производных полей из `content_json`:

```python
class Chapter(models.Model):
    # ...

    def rebuild_derived(self):
        """Перегенерує всі похідні поля з content_json."""
        if not self.content_json:
            self.rendered_html = None
            self.plain_text = None
            self.plain_text_length = 0
            self.toc_json = None
            self.reading_time = 0
            self.min_reading_time = 0
            return

        from apps.catalog.services.json_to_html import render_node
        from apps.catalog.services.content_utils import extract_plain_text, extract_toc

        self.rendered_html = render_node(self.content_json)
        self.plain_text = extract_plain_text(self.content_json)
        self.plain_text_length = len(self.plain_text)
        self.toc_json = extract_toc(self.content_json)

        # Читання: 200 слів/хв ≈ 1000 символів/хв
        chars = self.plain_text_length
        self.reading_time = int((chars / 1000) * 60)  # секунди
        self.min_reading_time = int(self.reading_time * 0.75)

    def save_content(self, content_json: dict):
        """Зберігає content_json, перегенерує похідні, інкрементує версію."""
        self.content_json = content_json
        self.content_version += 1
        self.rebuild_derived()
        self.save(update_fields=[
            'content_json', 'content_version',
            'rendered_html', 'plain_text', 'plain_text_length',
            'toc_json', 'reading_time', 'min_reading_time',
        ])
```

---

## Что менять и где: полный план по файлам

### Backend

#### 1. `backend/apps/catalog/models.py` — Модель Chapter

**Что делать:**
- Добавить поля: `content_json`, `content_version`, `rendered_html`, `plain_text`, `plain_text_length`, `toc_json`, `original_file`, `original_file_type`
- Добавить методы: `rebuild_derived()`, `save_content()`
- Изменить `save()` — убрать подсчёт символов по `len(html_content)`, использовать `plain_text_length`
- Пометить как deprecated (но НЕ удалять сразу): `file`, `html_content`, `html_file_path`, `character_count`, `characters_count`
- Удалить `get_html_content()` после миграции (заменяется на `rendered_html`)
- Удалить `save_html_content()` после миграции (заменяется на `save_content()`)

**Миграция данных:**
- Management-команда для конвертации существующих глав:
  - Для каждой главы с `file` (docx): `docx → content_json → rebuild_derived()`
  - Для глав без файла, но с `html_content`: `html → content_json` (через html-парсер) → `rebuild_derived()`

#### 2. Новый файл: `backend/apps/catalog/services/docx_to_json.py`

**Что делать:** создать модуль конвертации docx → content_json (описан выше в разделе 3).

**Зависимость:** `python-docx` (добавить в `requirements.txt`; **mammoth убрать после миграции**).

**Обработка изображений:**
- Извлекать embedded images из docx
- Сохранять в `books/<book_slug>/chapters/images/`
- В `content_json` ставить `src` с путём к media

#### 3. Новый файл: `backend/apps/catalog/services/json_to_html.py`

**Что делать:** создать рендерер content_json → HTML (описан выше в разделе 4).

**Важно:** HTML рендерится с inline-стилями (color, font-size, text-align), чтобы стили отображались в `dangerouslySetInnerHTML` без дополнительного CSS.

#### 4. Новый файл: `backend/apps/catalog/services/content_utils.py`

**Что делать:** утилиты `extract_plain_text()`, `extract_toc()` (описаны в разделе 5).

#### 5. `backend/apps/catalog/api/views.py` — add_chapter()

**Строки:** 251-333

**Что менять:**
```python
# БЫЛО:
result = mammoth.convert_to_html(docx_file)
html_content = result.value
chapter.save_html_content(html_content)

# СТАЛО:
from apps.catalog.services.docx_to_json import docx_to_content_json

content_json = docx_to_content_json(chapter.file.path, media_dir=chapter_media_dir)
chapter.save_content(content_json)
# original_file уже сохранён в chapter.file / chapter.original_file
```

- Убрать `import mammoth`
- Файл docx сохранять в `original_file` (или оставить в `file` на время миграции)
- Сохранять `original_file_type = 'docx'`

#### 6. `backend/apps/catalog/api/views.py` — chapter_detail()

**Строки:** 145-249

**Что менять:**
```python
# БЫЛО:
html_content = chapter.get_html_content()
if html_content is None:
    # ленивая конвертация mammoth
    result = mammoth.convert_to_html(docx_file)

# СТАЛО:
html_content = chapter.rendered_html
if html_content is None and chapter.original_file:
    # ленивая конвертация через python-docx
    content_json = docx_to_content_json(chapter.original_file.path, ...)
    chapter.save_content(content_json)
    html_content = chapter.rendered_html
```

- В response вместо `'content': html_content` → `'content': chapter.rendered_html`
- Можно добавить `'toc': chapter.toc_json` для навигации по содержимому главы

#### 7. `backend/apps/editors/api/views.py` — update_chapter()

**Строки:** 29-90

**Критическое исправление — регенерация HTML при замене файла:**

```python
# БЫЛО:
if 'file' in request.FILES:
    chapter.file = request.FILES['file']
chapter.save()
# HTML НЕ пересоздавался!

# СТАЛО:
if 'file' in request.FILES:
    # Удаляем старый файл
    if chapter.original_file and os.path.isfile(chapter.original_file.path):
        os.remove(chapter.original_file.path)
    chapter.original_file = request.FILES['file']
    chapter.original_file_type = 'docx'
    chapter.save(update_fields=['original_file', 'original_file_type'])

    # ОБЯЗАТЕЛЬНО пересоздаём content_json и производные
    content_json = docx_to_content_json(chapter.original_file.path, ...)
    chapter.save_content(content_json)
```

**Также добавить:** эндпоинт для сохранения `content_json` напрямую (для будущего WYSIWYG-редактора):

```python
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_chapter_content(request, chapter_id):
    """Зберігає content_json з редактора."""
    chapter = get_object_or_404(Chapter, id=chapter_id)
    if request.user != chapter.book.owner:
        return Response({'error': 'Forbidden'}, status=403)

    content_json = request.data.get('content')
    if not content_json:
        return Response({'error': 'content is required'}, status=400)

    # Валідація JSON-структури
    if not validate_content_json(content_json):
        return Response({'error': 'Invalid content format'}, status=400)

    chapter.save_content(content_json)
    return Response({'status': 'ok', 'content_version': chapter.content_version})
```

#### 8. `backend/apps/catalog/api/views.py` — delete_chapter()

**Строки:** 717-758

**Что менять:**
```python
# БЫЛО:
if chapter.file:
    os.remove(chapter.file.path)
if chapter.html_file_path:
    os.remove(os.path.join(settings.MEDIA_ROOT, chapter.html_file_path))

# СТАЛО:
if chapter.original_file:
    path = chapter.original_file.path
    if os.path.exists(path):
        os.remove(path)
# html_file_path больше не нужен — rendered_html хранится в БД
# Удалить каталог изображений главы при необходимости
```

#### 9. `backend/apps/catalog/api/serializers.py` — ChapterSerializer

**Что менять:**
- Убрать `character_count` / `characters_count` из полей (или маппить на `plain_text_length`)
- Не включать `content_json` в list-сериализатор (он большой)
- Для detail-ответа отдавать `rendered_html`, опционально `toc_json`

#### 10. Management-команда миграции

**Новый файл:** `backend/apps/catalog/management/commands/migrate_chapters_to_json.py`

```python
class Command(BaseCommand):
    help = 'Конвертує існуючі глави з docx/html_content у content_json'

    def handle(self, *args, **options):
        chapters = Chapter.objects.all()
        success = 0
        errors = 0

        for chapter in chapters:
            try:
                if chapter.file and os.path.exists(chapter.file.path):
                    # Приоритет: конвертация из docx
                    content_json = docx_to_content_json(chapter.file.path, ...)
                elif chapter.html_content:
                    # Фоллбэк: парсинг существующего HTML
                    content_json = html_to_content_json(chapter.html_content)
                else:
                    self.stderr.write(f"Chapter {chapter.id}: нет данных")
                    errors += 1
                    continue

                chapter.original_file = chapter.file  # переносим ссылку
                chapter.original_file_type = 'docx'
                chapter.save_content(content_json)
                success += 1
            except Exception as e:
                self.stderr.write(f"Chapter {chapter.id}: {e}")
                errors += 1

        self.stdout.write(f"Готово: {success} успішно, {errors} помилок")
```

#### 11. `backend/requirements.txt`

**Что менять:**
- Добавить: `python-docx>=1.1.0` (если ещё нет)
- После полной миграции: убрать `mammoth==1.8.0`

---

### Frontend

#### 12. `frontend/src/catalog/ChapterDetail.tsx` — рендеринг контента

**Текущее:** `dangerouslySetInnerHTML={{ __html: chapterContentHtml }}`

**Что менять:** на данном этапе ничего не менять — `rendered_html` с сервера уже содержит inline-стили, и `dangerouslySetInnerHTML` их корректно отображает.

**В будущем (при подключении редактора):** заменить `dangerouslySetInnerHTML` на Tiptap `<EditorContent>` в read-only mode — это даст:
- Консистентный рендеринг с редактором
- Возможность интерактивного выделения / комментирования текста
- Лучшую обработку изображений

#### 13. `frontend/src/catalog/AddChapter.tsx` — загрузка главы

**Что менять:**
- На первом этапе: ничего — загрузка docx работает как раньше, бэкенд делает конвертацию.
- На втором этапе: добавить вкладку/переключатель "Завантажити файл / Написати в редакторі":
  - Вкладка "Файл": текущая форма загрузки docx
  - Вкладка "Редактор": встроенный Tiptap-редактор, который сохраняет content_json напрямую через новый API-эндпоинт

#### 14. `frontend/src/editors/EditChapter.tsx` — редактирование главы

**Что менять:**
- На первом этапе: при замене файла — фронт должен инвалидировать кэш `chapterDetail`, чтобы при следующем открытии загрузился новый HTML.
- На втором этапе: добавить полноценный WYSIWYG-редактор, который:
  - Загружает `content_json` с сервера
  - Редактирует через Tiptap
  - Сохраняет через `PUT /api/editors/chapters/<id>/content/`
  - Поддерживает автосохранение (debounced save каждые N секунд)

#### 15. `frontend/src/api/catalogApi.ts` и `frontend/src/api/editorsApi.ts`

**Что менять:**
- Добавить новый API-метод для сохранения content из редактора:
  ```typescript
  export async function updateChapterContent(
    chapterId: number,
    contentJson: object
  ): Promise<{ content_version: number }> {
    const response = await api.put(`/api/editors/chapters/${chapterId}/content/`, {
      content: contentJson,
    });
    return response.data;
  }
  ```

---

## Этапы внедрения

### Этап 1: Backend — новый формат и конвертация (без изменения фронтенда)

**Цель:** система переходит на content_json, читатели видят стилизованный HTML.

1. Создать `docx_to_json.py`, `json_to_html.py`, `content_utils.py`
2. Добавить новые поля в модель Chapter (миграция Django)
3. Изменить `add_chapter()` — конвертация через python-docx
4. Изменить `chapter_detail()` — отдавать `rendered_html`
5. **Исправить `update_chapter()`** — регенерация при замене файла
6. Написать management-команду миграции
7. Запустить миграцию существующих глав
8. Тесты: загрузить docx с разными стилями, убедиться что цвета/размеры/выравнивание сохраняются

**Результат:** фронтенд НЕ меняется, но получает HTML с inline-стилями — стили отображаются.

### Этап 2: Очистка — удаление mammoth и старых полей

**Цель:** убрать легаси-код.

1. Убрать все вызовы mammoth из всех файлов (views.py, management commands)
2. Убрать `mammoth` из `requirements.txt`
3. Убрать `html_file_path` — файлы HTML на диске больше не нужны
4. Перенести `file` → `original_file` полностью
5. Убрать `character_count` / `characters_count`, использовать `plain_text_length`
6. Убрать `get_html_content()` / `save_html_content()`

### Этап 3: Frontend — WYSIWYG-редактор

**Цель:** авторы могут писать/редактировать главы прямо на сайте.

1. Установить `@tiptap/react`, `@tiptap/starter-kit`, расширения (textStyle, color, fontSize, textAlign, image, link, underline, highlight, table)
2. Создать компонент `ChapterEditor.tsx` — Tiptap-редактор с тулбаром
3. Добавить бэкенд-эндпоинт `update_chapter_content()` (PUT, принимает content_json)
4. Интегрировать в `AddChapter.tsx` (вкладка "Написати в редакторі")
5. Интегрировать в `EditChapter.tsx` (загрузка content_json, редактирование, сохранение)
6. Автосохранение (debounced, каждые 30 секунд при изменениях)

### Этап 4: Расширенные функции (будущее)

- История версий (diff между `content_json` v1 и v2)
- Черновики / публикация (`is_draft` поле)
- Коллаборативное редактирование (через Yjs + Tiptap Collaboration)
- Экспорт в docx / PDF из content_json
- Полнотекстовый поиск по `plain_text`
- Превью/сниппеты для каталога

---

## Валидация content_json

Перед сохранением content_json необходимо валидировать его структуру, чтобы предотвратить XSS и битые данные.

```python
ALLOWED_NODE_TYPES = {
    'doc', 'paragraph', 'heading', 'blockquote',
    'bulletList', 'orderedList', 'listItem',
    'image', 'horizontalRule', 'hardBreak',
    'table', 'tableRow', 'tableCell', 'text',
}

ALLOWED_MARK_TYPES = {
    'bold', 'italic', 'underline', 'strike',
    'textStyle', 'link', 'superscript', 'subscript', 'highlight',
}

def validate_content_json(data: dict, depth: int = 0) -> bool:
    if depth > 50:  # защита от слишком глубокой вложенности
        return False
    if not isinstance(data, dict):
        return False

    node_type = data.get('type')
    if node_type not in ALLOWED_NODE_TYPES:
        return False

    # Валидация marks
    for mark in data.get('marks', []):
        if mark.get('type') not in ALLOWED_MARK_TYPES:
            return False
        # Для link — проверить что href не javascript:
        if mark.get('type') == 'link':
            href = mark.get('attrs', {}).get('href', '')
            if href.startswith('javascript:'):
                return False

    # Для image — проверить что src не data:text/html или javascript:
    if node_type == 'image':
        src = data.get('attrs', {}).get('src', '')
        if src.startswith(('javascript:', 'data:text/html')):
            return False

    # Рекурсивная валидация children
    for child in data.get('content', []):
        if not validate_content_json(child, depth + 1):
            return False

    return True
```

---

## Безопасность rendered_html

`rendered_html` генерируется **на сервере** из валидированного `content_json` — это безопаснее, чем текущий подход с mammoth, потому что:

1. `content_json` проходит валидацию при сохранении
2. `json_to_html.py` использует `html.escape()` для всего текстового контента
3. Допускаются только белые списки тегов и атрибутов
4. URL в ссылках и изображениях проверяются на `javascript:` / опасные протоколы

Фронтенд продолжает использовать `dangerouslySetInnerHTML` — но контент теперь гарантированно безопасный благодаря серверной генерации.

---

## Обработка изображений в главах

### Текущая ситуация
Mammoth извлекает изображения из docx и вставляет их как `<img src="data:image/...">` (base64 inline). Это:
- Раздувает размер HTML
- Не кэшируется браузером
- Тормозит загрузку страницы

### Новый подход
1. При конвертации docx → content_json изображения **извлекаются** и сохраняются в:
   ```
   media/books/<book_slug>/chapters/images/<chapter_slug>_<hash>.<ext>
   ```
2. В `content_json` ставится `src` с путём к media:
   ```json
   { "type": "image", "attrs": { "src": "/media/books/my-book/chapters/images/ch1_a3f2.png" } }
   ```
3. При удалении главы — удаляется и каталог изображений

### Реализация (в docx_to_json.py)

```python
import hashlib
from docx.opc.constants import RELATIONSHIP_TYPE as RT

def extract_images(doc, book_slug, chapter_slug, media_root):
    """Извлекает изображения из docx и возвращает маппинг rId → URL."""
    image_map = {}
    images_dir = os.path.join(media_root, 'books', book_slug, 'chapters', 'images')
    os.makedirs(images_dir, exist_ok=True)

    for rel in doc.part.rels.values():
        if "image" in rel.reltype:
            image_data = rel.target_part.blob
            ext = rel.target_part.content_type.split('/')[-1]
            if ext == 'jpeg':
                ext = 'jpg'
            hash_suffix = hashlib.md5(image_data).hexdigest()[:8]
            filename = f"{chapter_slug}_{hash_suffix}.{ext}"
            filepath = os.path.join(images_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(image_data)

            url = f"/media/books/{book_slug}/chapters/images/{filename}"
            image_map[rel.rId] = url

    return image_map
```

---

## Сводная таблица: что было → что стало

| Аспект | Было | Стало |
|--------|------|-------|
| **Источник правды** | docx-файл на диске | `content_json` в БД |
| **Конвертация** | mammoth (теряет стили) | python-docx (сохраняет стили) |
| **Хранение HTML** | 2 кэша (БД + файл на диске) | 1 поле `rendered_html` в БД |
| **Подсчёт символов** | `len(html)` — считает теги | `len(plain_text)` — только текст |
| **Обновление файла** | HTML НЕ пересоздаётся (баг) | `save_content()` автоматически пересоздаёт всё |
| **Редактор на сайте** | Невозможен | Tiptap загружает/сохраняет тот же content_json |
| **Изображения** | Base64 inline (тяжёлый HTML) | Файлы на диске, URL в content_json |
| **Поиск по тексту** | Нет (только HTML) | `plain_text` — чистый текст |
| **Оглавление** | Нет | `toc_json` — заголовки из контента |
| **Версионирование** | Нет | `content_version` + возможность хранить историю |
| **Безопасность** | mammoth HTML без валидации | Валидация JSON + серверный рендеринг с escape |

---

## Файлы, которые затрагивает изменение

### Backend — модифицируются:
| Файл | Что менять |
|------|-----------|
| `backend/apps/catalog/models.py` | Новые поля, новые методы, изменение save() |
| `backend/apps/catalog/api/views.py` | add_chapter, chapter_detail, delete_chapter — замена mammoth |
| `backend/apps/editors/api/views.py` | update_chapter — регенерация HTML + новый эндпоинт update_chapter_content |
| `backend/apps/catalog/api/serializers.py` | Маппинг новых полей |
| `backend/apps/editors/api/urls.py` | Новый URL для update_chapter_content |
| `backend/apps/main/api/views.py` | 6 мест с mammoth — заменить |
| `backend/apps/catalog/management/commands/generate_html_content.py` | Перевести на новую систему |
| `backend/requirements.txt` | +python-docx, -mammoth (после миграции) |

### Backend — создаются:
| Файл | Назначение |
|------|-----------|
| `backend/apps/catalog/services/__init__.py` | Пакет сервисов |
| `backend/apps/catalog/services/docx_to_json.py` | Конвертация docx → content_json |
| `backend/apps/catalog/services/json_to_html.py` | Рендеринг content_json → HTML |
| `backend/apps/catalog/services/content_utils.py` | extract_plain_text, extract_toc, validate_content_json |
| `backend/apps/catalog/management/commands/migrate_chapters_to_json.py` | Миграция существующих глав |

### Frontend — модифицируются (Этап 3):
| Файл | Что менять |
|------|-----------|
| `frontend/src/catalog/AddChapter.tsx` | Вкладка "Написати в редакторі" |
| `frontend/src/editors/EditChapter.tsx` | WYSIWYG-редактор вместо/вместе с загрузкой файла |
| `frontend/src/api/editorsApi.ts` | Новый метод updateChapterContent |

### Frontend — создаются (Этап 3):
| Файл | Назначение |
|------|-----------|
| `frontend/src/editors/components/ChapterEditor.tsx` | Tiptap WYSIWYG-редактор |
| `frontend/src/editors/components/EditorToolbar.tsx` | Тулбар редактора |
