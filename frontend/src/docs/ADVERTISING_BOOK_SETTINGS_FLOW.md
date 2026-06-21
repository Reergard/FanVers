# Реклама книги — Frontend Flow (актуалізовано)

## Маршрут

| Сторінка | URL | Компонент |
|----------|-----|-----------|
| Налаштування книги | `/books/:slug/settings` | `SettingsBook` → вкладка «Реклама» → `Advertising` |

## Створення записів (backend)

- **Єдиний офіційний шлях створення:** `POST .../advertisements/submit_order/` з `{ items: [...] }` (одна книга, кілька позицій, `transaction.atomic()`, `select_for_update` на книгу та профіль).
- Стандартний **POST .../advertisements/** (create) **не доступний** — у `AdvertisementViewSet` немає `CreateModelMixin`; list / retrieve / update / destroy залишені за потреби.
- Перевірки дат для нових кампаній централізовані в `services.validate_dates_for_new_campaign` та в `Advertisement.clean()` (порядок дат завжди; «не в минулому» — лише для **нових** рядків, `self._state.adding`).

## Типи слотів (UI) → API

Ключі слотів `AdvertisingSlotKey`: `main`, `catalog`, `search_general`, `search_genre`, `search_tag`, `search_fandom`.

У запиті `submit_order` кожен елемент має:

- `location`: `main` | `catalog` | `search`
- `target_kind`: `none` | `genre` | `tag` | `fandom`
- `target_id`: число або `null` (для `none` завжди `null`)

Ціни за день узгоджені з `backend/apps/website_advertising/services.py` (головна 30; каталог 15; пошук: загальний 15, жанр 18, тег 12, фендом 18).

## UI компоненти сторінки налаштувань

- **Поля дат:** `DatePickerField` (`shared/DatePickerField/`) — кастомний text input + dropdown-календар (замість нативного `<input type="date">`). Валідація при blur, min/max блокування, українська локаль.
- **Фільтр таргету:** `FilterDropdown` (`navigation/FilterDropdown`) + метадані з `useBookFormMeta` (жанри, теги, фендоми).
- **Стан замовлення:** хук `useAdvertisingOrder` (`catalog/settings/useAdvertisingOrder.ts`) — дати, вартість, валідація.

## Публічна видача (різні сценарії)

| Поверхня | Що робить endpoint | Примітка |
|----------|-------------------|----------|
| Головна, каталог | `GET .../main_page_ads/`, `GET .../catalog_page_ads/` або універсальний `GET .../public/?location=main\|catalog` | Плоскі слоти (`target_kind=none`), без ранжування |
| Пошук | **`GET .../search_ads/`** з `genre_ids`, `tag_ids`, `fandom_ids` | Окремий сценарій: дедуп id фільтрів, score, стабільне сортування (-score, -pk), top N |

Фронт для головної/каталогу/пошуку використовує `AdvertisingCarousel` + відповідні `queryFn`.

## Документація для персоналу

Див. `ADVERTISING_STAFF_UA.md`.
