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
| `Profile.update_balance(amount, operation_type)` | там же | **Транзакція + `select_for_update()`** на рядок профілю. Для `withdraw`: спочатку роль (`API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE`), потім `balance < amount`. Для `purchase`/`advertising` — перевірка достатності балансу. Пише `BalanceLog`. Викликається безпосередньо з реклами та інших сервісів; **основний withdraw-view** іде через `BalanceOperationMixin.perform_balance_operation`, а не через цей метод (обидва шляхи мають `select_for_update`). |
| `BalanceLog` | `models.py` | Історія з типами `deposit`, `withdraw`, `purchase`, `earning`, `advertising`. |
| `BalanceOperationLog` | `apps/monitoring/models.py` | Аудит лише для **deposit/withdraw** у `BalanceOperationMixin`. |

## Зміна балансу з HTTP (основний шлях)

| Клас / view | URL | Дія |
|-------------|-----|-----|
| `AddBalanceView` | `POST /api/users/add-balance/` | `perform_balance_operation(..., 'deposit')`. |
| Той самий `AddBalanceView` | `POST /api/users/update-balance/` | Alias: та сама логіка; у відповіді текст «Баланс успішно оновлено» (перевірка `request.path`). |
| `WithdrawBalanceView` | `POST /api/users/withdraw-balance/` | Спочатку `profile_can_request_balance_withdraw`; тіло: `amount` передається в серіалізатор **як є** (без `float`). Потім `perform_balance_operation(..., 'withdraw')`. |

Файл: `apps/users/api/balance_views.py`.  
Маршрути: `apps/users/api/urls.py` (префікс API: `apps/api/urls.py` → `users/`).

## Міксин операцій

`apps/users/api/mixins.py` → `BalanceOperationMixin.perform_balance_operation`:

- `transaction.atomic()`, `Profile.objects.select_for_update().get(id=profile.id)`.
- Мінімальні суми: поповнення **100**, виведення **1000** (у текстах помилок на view часто FanCoins; у частині `ValidationError` міксина зустрічається формулювання «грн» — звертати увагу при уніфікації копірайту).
- Верхня межа операції: `settings.MAX_BALANCE_OPERATION_AMOUNT`.
- Типи операцій: списання — `withdraw`, `purchase`, `thanks_given`; зарахування — `deposit`, `earning`, `thanks_received`.
- **Withdraw по ролі** в міксині **не** дублюється навмисно — перевірка є у **view**, у **серіалізаторі** (UX-шар) і в **`Profile.update_balance()`** (третій шар для викликів поза основним withdraw-view, наприклад майбутніх management-команд чи сервісів, що підуть через модель).

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

- Покупки глав, підписки, подяки авторам, реклама — окремі сервіси/views; використовують `BalanceOperationMixin` або `Profile.update_balance` з іншими `operation_type`.
- Публічний **withdraw** — лише `POST .../withdraw-balance/`.

## Контрольний чеклист для розробника

1. Новий публічний вивід грошей — обов’язково ті самі правила ролі (`balance_access`) і бажано throttling.
2. Не покладатися лише на серіалізатор без view — контекст `request` може бути відсутній у тестах/фонових викликах.
3. Не робити `balance` записуваним у `ProfileSerializer` без окремого обґрунтування безпеки.
4. Зміни ролі в проді очікуються з адмінки при вимкненому self-promotion — тоді withdraw для «заробітчан» контролює адміністратор через роль.
