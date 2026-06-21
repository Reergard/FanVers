# Підрахунок символів та комісія — Backend

Документ описує повну реалізацію системи підрахунку символів глав та автоматичного перерахунку комісії власника книги.

---

## 1. Загальна логіка

Кожна глава (`Chapter`) зберігає кількість символів свого вмісту.
Кожен профіль власника (`Profile`) зберігає **накопичену суму** символів по всіх його книгах і главах.
На основі цієї суми автоматично встановлюється відсоток комісії.

**Пороги комісії:**

| Загальна кількість символів | Комісія |
|-----------------------------|---------|
| ≥ 10 000 000 | 10% |
| ≥ 5 000 000 | 12% |
| < 5 000 000 | 15% |

---

## 2. Де зберігаються дані

### `Chapter` (`apps/catalog/models.py`)

| Поле | Тип | Призначення |
|------|-----|-------------|
| `characters_count` | `IntegerField` | Кількість символів — **джерело правди** |
| `character_count` | `IntegerField` | Дублює `characters_count` — спадщина, завжди рівний `characters_count` |
| `reading_time` | `IntegerField` | Розрахунковий час читання (секунди): `(characters_count / 1000) * 55` |
| `min_reading_time` | `IntegerField` | Мінімум для зарахування прочитання: `reading_time * 0.75` (використовується в `ChapterProgressView` разом із `scroll_progress >= 55`) — **READING_PROGRESS_BACKEND.md** |

### `Profile` (`apps/users/models.py`)

| Поле | Тип | Призначення |
|------|-----|-------------|
| `total_characters` | `BigIntegerField` | Накопичена сума `characters_count` по всіх главах всіх книг власника |
| `commission` | `DecimalField` | Поточний відсоток комісії (10.00 / 12.00 / 15.00) |

`total_characters` — хранимое поле. Оновлюється атомарно через сигнали при кожній зміні `characters_count` у главах. **Агрегатний запрос по всіх главах не виконується.**

---

## 3. Коли і як рахуються символи

### Основний шлях — завантаження глави

1. `POST /api/catalog/books/<slug>/add_chapter/` (`apps/catalog/api/views.py`, функція `add_chapter`).
2. View створює `Chapter` (без HTML — `characters_count = 0`).
3. Mammoth конвертує `.docx` у HTML.
4. Викликається `chapter.save_html_content(html_content)`.
5. Усередині `save_html_content`:
   - HTML спочатку проходить через **`sanitize_chapter_html`** (bleach — дозволені теги, без атрибутів/стилів).
   - Підрахунок символів через **`_chapter_plain_text_len(html_content)`**:
     ```python
     plain_len = _chapter_plain_text_len(html_content)
     self.character_count = plain_len
     self.characters_count = plain_len
     ```
   - `save(update_fields=[...])` зберігає поля.
6. `save(update_fields=[...])` запускає сигнали Django (`pre_save` → `post_save`).
7. Сигнал атомарно оновлює `Profile.total_characters` і перераховує комісію.

### Резервний шлях — ліниве генерування HTML

Якщо HTML не було згенеровано під час завантаження (помилка), він генерується при **першому відкритті** глави:
`GET /api/catalog/books/<slug>/chapters/<chapter_slug>/` (`chapter_detail` view) → `chapter.save_html_content(html_content)`.
Сигнальний ланцюг той самий — символи оновляться при першому читанні.

### Формула підрахунку (поточна)

```python
def _chapter_plain_text_len(html_str: str) -> int:
    text = strip_tags(html_str)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return len(text)
```

> Рахується довжина **чистого тексту** після видалення HTML-тегів (`strip_tags`), декодування HTML-сутностей (`html.unescape`) та нормалізації пробілів. Попередня проблема з підрахунком HTML-довжини (включно з тегами) **виправлена**.

---

## 4. Сигнальний ланцюг (ключова механіка)

Файл: `apps/users/models.py` (нижня частина, три receiver-и).

### `pre_save` → `capture_old_chapter_chars`

Перед **кожним** `save()` глави читає поточний `characters_count` з БД і зберігає в `instance._old_characters_count`.
Для нових об'єктів (pk = None) — ставить 0.

```
Chapter.save() викликано
    ↓
pre_save: читає old = DB.characters_count  → instance._old_characters_count = old
    ↓
SQL UPDATE виконується
    ↓
post_save: delta = instance.characters_count - _old_characters_count
```

### `post_save` → `update_profile_on_chapter_save`

```python
delta = new_count - old_count
if delta == 0: return  # нічого не змінилось — пропускаємо

Profile.objects.filter(user_id=owner_id).update(
    total_characters=F('total_characters') + delta  # атомарний UPDATE
)
profile = Profile.objects.get(user_id=owner_id)    # свіжий об'єкт
profile.update_commission()                          # оновлює commission якщо потрібно
```

`F('total_characters') + delta` — атомарний SQL-вираз, безпечний при паралельних запитах.

### `post_delete` → `update_profile_on_chapter_delete`

При видаленні глави вираховує її `characters_count` з `Profile.total_characters`.
Перераховує комісію.

---

## 5. `Profile.update_commission()`

```python
def update_commission(self):
    total_chars = self.total_characters  # читає хранимое поле, без запиту
    if total_chars >= 10_000_000:
        new_commission = Decimal('10.00')
    elif total_chars >= 5_000_000:
        new_commission = Decimal('12.00')
    else:
        new_commission = Decimal('15.00')
    if self.commission != new_commission:      # зберігає лише при зміні
        self.commission = new_commission
        self.save(update_fields=['commission'])
```

---

## 6. Management commands

| Команда | Файл | Що робить |
|---------|------|-----------|
| `sync_total_characters` | `apps/catalog/management/commands/sync_total_characters.py` | **Головна команда відновлення.** Агрегує `characters_count` з БД, виправляє `total_characters` і `commission` для всіх профілів. Підтримує `--dry-run` і `--user-id`. |
| `update_recent_chapters` | `apps/catalog/management/commands/update_recent_chapters.py` | Знаходить глави з HTML але `characters_count=0`, рахує і зберігає. Сигнали спрацюють (через `save(update_fields=...)`). |
| `update_characters_count` | `apps/catalog/management/commands/update_characters_count.py` | Копіює `character_count → characters_count` для глав де `characters_count=0`. Сигнали спрацюють. |
| `generate_html_content` | `apps/catalog/management/commands/generate_html_content.py` | Генерує HTML з `.docx` для глав без HTML. Викликає `save_html_content()` → сигнали спрацюють. |

> Всі команди використовують `model.save(update_fields=[...])`, що **запускає сигнали Django**. `Profile.total_characters` оновлюється автоматично.

**Порядок відновлення після проблем:**
```bash
python manage.py generate_html_content      # якщо є глави без HTML
python manage.py update_recent_chapters     # якщо є глави з HTML але characters_count=0
python manage.py sync_total_characters      # фінальна перевірка профілів
```

---

## 7. Міграція

`apps/users/migrations/0004_profile_total_characters.py` — додає поле `total_characters` і заповнює його з актуальних даних (`RunPython`). При першому `migrate` backfill виконується автоматично.

---

## 8. Файли системи

| Файл | Роль |
|------|------|
| `apps/catalog/models.py` | `Chapter.save()`, `Chapter.save_html_content()` — підрахунок символів при збереженні |
| `apps/catalog/api/views.py` | `add_chapter` — завантаження глави; `chapter_detail` — ліниве генерування HTML |
| `apps/users/models.py` | `Profile.total_characters`, `Profile.update_commission()`, три сигнали для Chapter |
| `apps/users/migrations/0004_profile_total_characters.py` | Міграція поля + backfill |
| `apps/catalog/management/commands/sync_total_characters.py` | Ручна синхронізація |

---

## 9. Пов'язана документація

- Frontend: `frontend/src/docs/CHARACTERS_COUNT_COMMISSION_FRONTEND.md`
- ~~Відкрите питання (HTML vs текст)~~: вирішено — підрахунок тепер через `_chapter_plain_text_len()` (чистий текст, без тегів)
- Завантаження глав: `backend/docs/ADD_CHAPTER_BACKEND.md`
