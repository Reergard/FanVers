# Реклама книги — Frontend Flow

Документ описує логіку вкладки «Реклама» в налаштуваннях книги: файли, типи розміщень, розрахунок вартості, валідація, submit і відображення реклами на сайті.

---

## 1. Маршрут і місце

| Сторінка | URL | Компонент | Захист |
|----------|-----|------------|--------|
| Налаштування книги | `/books/:slug/settings` | SettingsBook | Перевірка власника в useEffect |
| Вкладка «Реклама» | — | Advertising | Рендериться в SettingsBook при `activeTab === "advertising"` |

Доступ до вкладки «Реклама» мають тільки власники книги. Перевірка виконується в `SettingsBook` до рендеру будь-якої вкладки.

---

## 2. Файли

| Файл | Призначення |
|------|-------------|
| `catalog/settings/Advertising.tsx` | UI-оркестрація: форма, кнопки, submit |
| `catalog/settings/Advertising.module.css` | Стилі сторінки реклами |
| `catalog/settings/advertising.types.ts` | PlacementType, PlacementOrderState, CreateAdvertisementPayload (єдине джерело типу) |
| `catalog/settings/advertising.constants.ts` | PRICE_PER_DAY, PLACEMENT_AVAILABLE |
| `catalog/settings/advertising.utils.ts` | calcDays, calcCost, validatePlacement, getMinStartDate |
| `catalog/settings/advertising.data.ts` | Конфіг розміщень (title, description, filterType) |
| `catalog/settings/useAdvertisingOrder.ts` | Хук: placements state, updatePlacement, addToOrder, submit |
| `api/advertisingApi.ts` | getMainPageAds, getUserAdvertisements, getBookAdvertisements, submitAdvertisingOrder, advertisingKeys; реекспорт CreateAdvertisementPayload з advertising.types |

---

## 3. Типи розміщень

| placementType | Назва | Вартість/день | Доступність | Таргет |
|---------------|-------|---------------|--------------|--------|
| `main` | Реклама на головній | 30 FanCoins | ✅ | — |
| `catalog` | Реклама на сторінці Каталог | 15 FanCoins | ✅ | — |
| `genres` | Реклама у пошуку за жанрами | 15 FanCoins | ❌ (Скоро) | Жанр |
| `tags` | Реклама у пошуку за тегами | 15 FanCoins | ❌ (Скоро) | Теги |
| `fandoms` | Реклама у пошуку за фендом | 15 FanCoins | ❌ (Скоро) | Фендоми |

`PLACEMENT_AVAILABLE` у `advertising.constants.ts` визначає, чи можна замовляти розміщення. Genre/tag/fandom поки що в розробці на бекенді.

**PlacementType = backend location:** значення `main`, `catalog`, `genres`, `tags`, `fandoms` узгоджені з `Advertisement.LOCATION_CHOICES` у backend (`apps/website_advertising/models.py`).

---

## 4. Поля для кожного типу

**Для main і catalog:**
- `startDate`, `endDate` — обов’язкові
- `targetId` — не потрібен

**Для genre/tag/fandom (коли будуть доступні):**
- `startDate`, `endDate` — обов’язкові
- `targetId` — обов’язковий (id жанру/тегу/фендома)

---

## 5. Розрахунок вартості

**Дні (inclusive):**
```
days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
```

**Вартість позиції:**
```
totalCost = days * pricePerDay
```

**Загальна вартість:**
Сума тільки з `includedInOrder === true` (позиції, додані в заказ кнопкою «Додати в заказ» або чекбоксом).

---

## 6. Потік submit

### 6.1. Перед відправкою (перевірки)

1. `book?.id` — книга існує
2. `userId == null || book.owner !== userId` — користувач власник
3. `orderedPlacements.length > 0` — хоча б одна позиція в заказі
4. `totalCost > 0` — сума більше нуля
5. `balanceNum >= totalCost` — достатньо коштів на балансі

### 6.2. Payload

```ts
{ items: [{ book, location, start_date, end_date }, ...] }
```

### 6.3. Відправка

```ts
submitAdvertisingOrder({ items: payloads }) — один POST /api/website_advertising/advertisements/submit_order/
```
Атомарна транзакція на бекенді: весь заказ створюється або нічого.

### 6.4. Успіх

1. `refreshAuthStatus()` — оновлення балансу в Header
2. `queryClient.invalidateQueries({ queryKey: advertisingKeys.userAds() })`
3. `queryClient.invalidateQueries({ queryKey: advertisingKeys.bookAds(book.id) })`
4. `showSuccess("Реклама успішно створена")`
5. `navigate(\`/books/${slug}\`)`

### 6.5. Помилка

- `showError(msg)` з backend або загальне повідомлення
- `refreshAuthStatus()` — оновлення балансу (на випадок часткового списання)
- Інвалідація `userAds` + `bookAds` — як і при успіху
- Типові помилки: «Недостатньо коштів на балансі», «Для книги вже є активна реклама на вибрані дати»

---

## 7. Query keys

| Key | Призначення |
|-----|-------------|
| `advertisingKeys.userAds()` | Реклама поточного користувача |
| `advertisingKeys.mainPage()` | Реклама для головної (публічний блок) |
| `advertisingKeys.bookAds(bookId)` | Реклама книги (фільтр на клієнті) |

Після submit інвалідуються `advertisingKeys.userAds()` та `advertisingKeys.bookAds(book.id)`.

---

## 8. Відображення реклами на сайті

- **Головна сторінка:** `getMainPageAds()` → `GET /api/website_advertising/advertisements/main_page_ads/`
- **Каталог:** `GET /api/website_advertising/advertisements/catalog_page_ads/` (endpoint є на бекенді)

Блоки реклами читають відповідні API і відображають книги в каруселі «Реклама».

---

## 9. Примітка про бекенд

- **Вартість за день:** бекенд зараз використовує `30` для всіх типів. На фронті: main=30, catalog/genres/tags/fandoms=15. Для узгодженості потрібно оновити бекенд `perform_create` на використання вартості за типом (location).
- **Genre/tag/fandom:** модель `Advertisement` має `location` без `target_id`. Для підтримки таргетованої реклами потрібне розширення моделі. Фронт збирає `targetId` у стані, але **не відправляє його в API** — backend не підтримує. Після розширення бекенду потрібно додати `target_id` у payload.

---

## 10. Відомі обмеження та архітектурні ноти

### 10.1. submit_order — атомарний batch endpoint

Використовується `submitAdvertisingOrder({ items })` → один POST на `/submit_order/`. Backend обгортає весь заказ у `transaction.atomic()`.

### 10.2. getBookAdvertisements — backend endpoint

`getBookAdvertisements(bookId)` викликає `GET /book_advertisements/?book={id}`. Фільтр на бекенді.

### 10.3. Баланс з useAuth()

Баланс береться з `useAuth()` (auth-status). Після submit викликається `refreshAuthStatus()` для оновлення. Якщо auth-status не завжди повертає актуальний баланс — можна розглянути окремий query профілю.

### 10.4. Чекбокс і кнопка «Додати в заказ»

Обидва елементи додають позицію в заказ. Це дублікат керування, але зберігає гнучкість: чекбокс — швидкий вибір, кнопка — явна підтвердження.
