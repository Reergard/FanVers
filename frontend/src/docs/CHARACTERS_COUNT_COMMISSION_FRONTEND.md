# Підрахунок символів та комісія — Frontend

Документ описує де і як на фронтенді відображаються дані про кількість перекладених символів та комісію автора/перекладача.

---

## 1. Звідки дані

Єдине джерело — `GET /api/users/profile/` (`getMyProfile` у `users/profileService.ts`).

Відповідне поле в типах — `UserProfile` (`users/types.ts`):

```ts
total_characters?: number;   // загальна кількість символів усіх глав власника
commission?: string | number; // поточний % комісії (10 / 12 / 15)
```

Backend обчислює обидва значення на основі хранимих полів `Profile.total_characters` і `Profile.commission` — без агрегації по главах при кожному запиті.

---

## 2. Де відображається

### Сторінка "Власні переклади" — `users/UserTranslations.tsx`

Бічна панель «Статистика діяльності»:

| Мітка | Поле з API | Примітка |
|-------|-----------|----------|
| Перекладів | `profile.total_translations` | Кількість книг типу TRANSLATION |
| Сторінок переведено | `profile.total_chapters` | Кількість глав |
| **Символів переклав** | **`profile.total_characters`** | Накопичена сума символів |
| **Комісія** | **`profile.commission`** | % комісії |

```tsx
// users/UserTranslations.tsx
<span className={styles.statValue}>
  {profile?.total_characters?.toLocaleString("uk-UA") ?? 0}
</span>

<span className={styles.commissionValue}>
  {profile?.commission != null ? `${Number(profile.commission)}%` : "15%"}
</span>
```

Дані приходять через `useQuery({ queryKey: profileQueryKey(userId), queryFn: getMyProfile, ... })` (`shared/queryKeys.ts`) — той самий кеш, що й сторінка профілю та інші екрани з `userId`.

### Сторінка профілю — `users/Profile.tsx`

`total_characters` і `commission` доступні через той самий запит профілю. Відображення — якщо є відповідний UI-блок для власника профілю.

---

## 3. Оновлення даних

Дані `total_characters` і `commission` оновлюються на бекенді **автоматично** при збереженні/видаленні глав (через сигнали Django).

На фронтенді React Query кешує відповідь за ключем **`profileQueryKey(userId)`**. Щоб побачити актуальні цифри після завантаження нової глави:
- Перезавантажити сторінку, або
- Виконати `queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) })` після успішного завантаження глави.

Поточна реалізація `UserTranslations.tsx` не інвалідує кеш автоматично після дій з главами — числа оновляться при наступному завантаженні сторінки або через `refetchOnWindowFocus`.

---

## 4. Типи

**`users/types.ts` — `UserProfile`:**

```ts
total_characters?: number;
commission?: string | number;
total_translations?: number;
total_chapters?: number;
```

`commission` може прийти як рядок (`"15.00"`) або число — `Number(profile.commission)` перетворює обидва варіанти коректно.

---

## 5. Пов'язана документація

- Backend-логіка: `backend/docs/CHARACTERS_COUNT_COMMISSION_BACKEND.md`
- Відкрите питання (HTML vs текст): `frontend/src/docs/fixes/CHARACTERS_COUNT_HTML_VS_TEXT.md`
- Дані користувача / auth store: `frontend/src/docs/USER_DATA_FLOW.md`
- Поповнення/виведення балансу: `frontend/src/docs/BALANCE_DEPOSIT_WITHDRAW_FRONTEND.md`
