# Subscription System — Backend

Документ описує реалізацію системи підписки на бекенді.

---

## 1. Структура

```
backend/apps/subscription/
├── __init__.py
├── apps.py
├── models.py
├── admin.py
├── services.py
├── migrations/
│   ├── 0001_initial.py
│   ├── 0002_settings_pricing_and_constraints.py
│   ├── 0003_admin_audit_log.py
│   ├── 0004_usage_restored_refunded_status.py
│   ├── 0005_user_chapter_access.py
│   ├── 0006_populate_user_chapter_access.py
│   ├── 0007_allow_prepaid_and_instant.py
│   ├── 0008_plan_discount_and_mode.py
│   ├── 0009_price_optional.py
│   ├── 0010_unique_active_plans_only.py
│   └── 0011_remove_legacy_settings_fields.py
└── api/
    ├── __init__.py
    ├── views.py
    ├── serializers.py
    └── urls.py
```

---

## 2. Моделі

### BookSubscriptionSettings
- `book` (OneToOne)
- `is_enabled` — чи увімкнена підписка
- `created_at`, `updated_at`

### BookSubscriptionPlan
- `settings` (FK)
- `discount_percent` — відсоток знижки (наприклад, 10)
- `discount_threshold` — поріг: знижка діє при покупці від N розділів
- `purchase_mode` — `prepaid` (Пакет) або `instant` (Миттєва покупка обраних)
- `chapters_count`, `price` — legacy-поля для backward compatibility, не є джерелом правди та не експортуються в API
- `is_active`, `sort_order`
- Унікальність серед активних: (settings, discount_percent, discount_threshold, purchase_mode)
- Максимум 2 активних плани на книгу. Гарантується сервісним шаром і блокуванням `select_for_update()` під час оновлення налаштувань
- `ordering`: sort_order, discount_threshold, id

**Розрахунок ціни:**
- Ціна плану рахується з цін глав: сума цін × (1 − discount_percent/100) при кількості ≥ discount_threshold
- Для prepaid: беруться перші N платних глав книги
- Для instant: беруться обрані користувачем глави

### UserBookSubscription
- `user`, `book`, `plan`
- `purchased_chapters_count`, `remaining_chapters_count` (snapshot)
- `price_paid` (snapshot)
- `status`: active, exhausted, expired, cancelled, refunded
- `purchase_mode`: prepaid, instant_selected

### UserChapterAccess
- Джерело правди для доступу до глави
- `user`, `chapter`, `book`, `source` (balance_purchase, prepaid_subscription, instant_bulk_apply, admin_restore)
- `subscription` (nullable) — для prepaid/bulk

### UserBookSubscriptionUsage
- `subscription`, `chapter`
- `usage_type`: consume, bulk_apply, adjustment_refund, adjustment_restore
- `source`: chapter_buy_button, bulk_apply_request, admin_panel, support_fix

### SubscriptionOperation
- Ідемпотентність: (user, operation_type, idempotency_key) unique

---

## 3. API

| Метод | URL | Опис |
|-------|-----|------|
| GET | `/api/subscription/books/<slug>/` | Налаштування + плани + активний пакет. **Не створює запис**: якщо налаштувань немає — повертає дефолт без збереження в БД |
| PUT | `/api/subscription/books/<slug>/` | Оновити налаштування (тільки власник). При першому збереженні створює запис. Повертає оновлений instance з сервісу |
| POST | `/api/subscription/books/<slug>/purchase-plan/` | Купити пакет (prepaid) |
| POST | `/api/subscription/books/<slug>/apply-plan/` | Instant: застосувати план до обраних глав |
| GET | `/api/subscription/user/subscriptions/` | Активні + історія підписок |

### Формат планів (PUT / GET)

Плани передаються з полями:
- `discount_percent`, `discount_threshold`, `purchase_mode` (prepaid | instant)
- `is_active`, `sort_order`
- `price_preview` (read-only) — розрахована ціна для відображення

**Валідація PUT:**
- `discount_percent` > 0 (план без знижки не має сенсу)
- `discount_threshold` ≥ 1
- Якщо `is_enabled = true` — обовʼязково хоча б один активний план

### apply-plan

- План має бути з `purchase_mode=instant`
- Користувач обирає ≥ discount_threshold глав
- Ціна = сума цін обраних глав × (1 − discount_percent/100)

### purchase-plan

- План має бути з `purchase_mode=prepaid`
- Ціна = сума цін перших N платних глав × (1 − discount_percent/100)

---

## 4. Покупка глави

`POST /api/users/purchase-chapter/<id>/`:

1. Якщо вже куплена (UserChapterAccess) → success, нічого не списується
2. Якщо є активний prepaid пакет (remaining > 0) → списується 1 слот
3. Інакше → покупка за баланс (ціна з `chapter.price`)

**Окрема покупка кожної глави завжди дозволена.** Ціна вказується при створенні глави.

---

## 5. Запуск міграцій

```bash
cd backend
python manage.py migrate
```

Потрібні міграції: `monitoring` (TransactionLog), `subscription` (0001–0011).

---

## 6. Валюта

Використовується **FanCoins**.
