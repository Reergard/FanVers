# Subscription System — Frontend

Документ описує реалізацію системи підписки на фронтенді.

---

## 1. Компоненти

| Компонент | Файл | Роль |
|-----------|------|------|
| `Subscription` | `catalog/settings/Subscription.tsx` | Налаштування підписки для власника книги |
| `SubscriptionPurchaseBlock` | `catalog/sections/SubscriptionPurchaseBlock.tsx` | Блок абонименту на сторінці книги: плани prepaid, активний пакет |
| `BookChapters` | `catalog/sections/BookChapters.tsx` | Список глав: кнопка «Купити» для окремої покупки глави або використання активного prepaid-пакета; чекбокси для instant-плану |
| `ChapterDetailRouter` | `catalog/ChapterDetailRouter.tsx` | Сторінка глави: при 403 показує кнопку «Купити» |
| `UserSubscriptionsSection` | `users/UserSubscriptionsSection.tsx` | Профіль: вкладки «Активні» та «Історія» підписок |

---

## 2. API (subscriptionApi.ts)

- `getSubscriptionSettings(bookSlug)` — GET налаштувань + плани + active_subscription (якщо настроек немає — API повертає дефолт без створення запису)
- `updateSubscriptionSettings(bookSlug, payload)` — PUT налаштувань
- `purchasePlan(bookSlug, planId)` — купити prepaid-пакет
- `applyPlan(bookSlug, planId, chapterIds)` — миттєва покупка обраних глав
- `purchaseChapter(chapterId)` — купити одну главу (баланс або prepaid)
- `getUserSubscriptions()` — активні + історія

---

## 3. Структура плану

```ts
SubscriptionPlan = {
  id, discount_percent, discount_threshold, purchase_mode: 'prepaid' | 'instant',
  price_preview?, is_active, sort_order
}
```

- **prepaid** — показується в `SubscriptionPurchaseBlock`, купівля пакета
- **instant** — показується в `BookChapters` (чекбокси + «Придбати обрані»)

---

## 4. Потік покупки з prepaid на сторінці книги

1. Користувач має активний пакет (`active_subscription.remaining_chapters_count > 0`)
2. Клік «Купити» на платній главі → `purchaseChapter(chapterId)`
3. Після успіху → `navigate` на сторінку глави
4. Підказка під блоком «У вас є активний пакет»: *Щоб використати пакет, натисніть «Купити» біля потрібного розділу*

---

## 5. Потік instant (міттєва покупка обраних)

1. Користувач обирає план з `purchase_mode === 'instant'`
2. Ставить чекбокси біля глав (мін. discount_threshold)
3. Клік «Придбати обрані» → `applyPlan(bookSlug, planId, chapterIds)`

---

## 6. Налаштування (Subscription.tsx)

Власник книги налаштовує плани:
- `discount_percent` — % знижки (обовʼязково > 0, backend відхилить план без знижки)
- `discount_threshold` — від N розділів (≥ 1)
- `purchase_mode` — Пакет (prepaid) або Миттєва покупка обраних (instant)
- `is_active` — Активовано

Максимум 2 активних плани. При увімкненій підписці потрібен щонайменше один активний план. Окрема покупка кожної глави завжди дозволена (ціна з глави).
