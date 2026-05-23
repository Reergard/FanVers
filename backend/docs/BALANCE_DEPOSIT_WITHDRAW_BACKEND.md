# Поповнення та виведення балансу (Backend)

## Призначення

Користувач поповнює баланс (FanCoins) через API; виводить кошти — **лише** якщо дозволено правилами ролі. Адмінка та внутрішні сервіси **не** обмежуються цими правилами там, де баланс змінюють напряму в моделі або окремою логікою.

## Джерело істини для правил

| Модуль | Що визначає |
|--------|-------------|
| `apps/users/balance_access.py` | Хто може ініціювати **withdraw** через публічний API: ролі з `WITHDRAW_ELIGIBLE_PROFILE_ROLES` (`Перекладач`, `Літератор`). Константи `API_WITHDRAW_ROLE_FORBIDDEN_*` для єдиного тексту/коду відмови. |
| `apps/users/role_self_promotion.py` | Для сумісності API: `is_role_self_promotion_allowed()` завжди **true**. Дозволені переходи задаються в `become_translator` / `become_author` за поточною роллю (глобального вимикача в `settings` немає). |

Перевірка «достатньо грошей» і ліміти сум — окремо від права на вивід; право на вивід **не** прив’язане до наявності доходу чи книг.

## Модель і зміни балансу

| Що | Файл | Примітка |
|----|------|----------|
| Поле балансу | `apps/users/models.py` → `Profile.balance` | `DecimalField`; адмінка може редагувати як раніше. |
| `Profile.can_withdraw_balance()` | там же | Делегує `profile_can_request_balance_withdraw(self)`. |
| `Profile.balance_operation(amount, operation_type)` | там же | **Єдиний метод зміни балансу.** Транзакція + `select_for_update()` на рядок профілю. Перевірки: роль (для `withdraw`), достатність коштів (для дебетових операцій), максимальний баланс 1 000 000 (для кредитових), мінімальні суми (deposit ≥ 100, withdraw ≥ 1000), максимальна сума операції (1 000 000). Створює `BalanceLog`. Для deposit/withdraw/refund додатково створює `BalanceOperationLog`. |
| `BalanceLog` | `models.py` | Історія з типами `deposit`, `withdraw`, `purchase`, `earning`, `advertising`, `refund`, `thanks_given`, `thanks_received`. |
| `BalanceOperationLog` | `apps/monitoring/models.py` | Аудит для **deposit/withdraw/refund** (створюється з `balance_operation()`). |

## Зміна балансу з HTTP (основний шлях)

| Клас / view | URL | Дія |
|-------------|-----|-----|
| `AddBalanceView` | `POST /api/users/add-balance/` | `profile.balance_operation(amount, 'deposit')`. |
| Той самий `AddBalanceView` | `POST /api/users/update-balance/` | Alias: та сама логіка; у відповіді текст «Баланс успішно оновлено» (перевірка `request.path`). |
| `WithdrawBalanceView` | `POST /api/users/withdraw-balance/` | Спочатку `profile_can_request_balance_withdraw`; далі делегує `create_payout_request()` з `apps.payouts`. |

Файл: `apps/users/api/balance_views.py`.  
Маршрути: `apps/users/api/urls.py` (префікс API: `apps/api/urls.py` → `users/`).

## Метод balance_operation()

`apps/users/models.py` → `Profile.balance_operation(amount, operation_type)`:

- `transaction.atomic()`, `Profile.objects.select_for_update().get(pk=self.pk)`.
- Мінімальні суми: поповнення **100**, виведення **1000**.
- Верхня межа однієї операції: **1 000 000**. Максимальний баланс: **1 000 000**.
- Дебетові операції (списання): `withdraw`, `purchase`, `advertising`, `thanks_given`.
- Кредитові операції (зарахування): `deposit`, `earning`, `thanks_received`, `refund`.
- Для `withdraw` додатково перевіряється роль через `profile_can_request_balance_withdraw`.
- Завжди створює `BalanceLog`; для `deposit`/`withdraw`/`refund` додатково `BalanceOperationLog` (мониторинг).
- Повертає створений `BalanceLog` запис.

## Серіалізатори

Файл `apps/users/api/serializers.py`:

- `UpdateBalanceSerializer` — тільки `amount` для поповнення.
- `BalanceOperationSerializer` — `amount` + `operation_type` (`deposit`/`withdraw`). Для `withdraw`: безпечний доступ до `request.user.profile`, роль через `profile_can_request_balance_withdraw`, перевірка балансу — **лише UX** (гонку закриває блокування в міксині/моделі).
- `ProfileSerializer`: `balance` **read_only** для власника (неможливо змінити PATCH’ем). `get_can_withdraw_balance` — **тільки для власника профілю**, для чужого профілю повертає `null`.

## Прапорці для клієнта

`AuthStatusView` (`apps/users/api/views.py`), `GET /api/users/auth-status/`:

- `balance`, `can_withdraw_balance`, `role_self_promotion_allowed`.

У профілі ті самі сенси через `ProfileSerializer` (+ `role_self_promotion_allowed` для клієнтської сумісності, завжди **true**).

## Самозміна ролі (зв’язок із виводом)

`become_translator` / `become_author`: у межах `transaction.atomic()` — `Profile.objects.select_for_update().get(user_id=...)`, перевірка поточної ролі, `save(update_fields=['role'])`. `become_translator` — лише з ролі **«Читач»**; `become_author` — з **«Читач»** або **«Перекладач»**; інакше **400** з поясненням.

## Обмеження швидкості

`AddBalanceView`, `WithdrawBalanceView`: `throttle_classes = [ScopedRateThrottle]`, `throttle_scope = 'balance'`. Ліміт у `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['balance']` у `FanVers_project/settings.py`.

## Що не є частиною «поповнити/вивести», але змінює баланс

- Покупки глав, підписки, подяки авторам, реклама — окремі сервіси/views; використовують `Profile.balance_operation()` з відповідними `operation_type`.
- Публічний **withdraw** — лише `POST .../withdraw-balance/`.

## Контрольний чеклист для розробника

1. Новий публічний вивід грошей — обов’язково ті самі правила ролі (`balance_access`) і бажано throttling.
2. Не покладатися лише на серіалізатор без view — контекст `request` може бути відсутній у тестах/фонових викликах.
3. Не робити `balance` записуваним у `ProfileSerializer` без окремого обґрунтування безпеки.
4. Зміни ролі в проді очікуються з адмінки при вимкненому self-promotion — тоді withdraw для «заробітчан» контролює адміністратор через роль.
