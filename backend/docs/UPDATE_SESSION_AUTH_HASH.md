# update_session_auth_hash при зміні пароля

## Що це таке?

`update_session_auth_hash(request, user)` — це функція Django, яка оновлює хеш сесії після зміни пароля користувача.

## Навіщо вона потрібна?

Коли користувач змінює пароль через `user.set_password(new_password)` і `user.save()`, Django інвалідує всі існуючі сесії цього користувача з міркувань безпеки. Це означає, що **поточна сесія** теж стає недійсною — користувач буде вибитий з системи одразу після зміни пароля.

`update_session_auth_hash` оновлює хеш у поточній сесії, щоб вона залишалася валідною після зміни пароля. Тобто користувач **не виходить** з системи після зміни пароля.

## Де це використовується в проекті?

```python
# backend/apps/users/api/views.py, функція change_password

def change_password(request):
    ...
    user.set_password(new_password)
    user.save()
    
    update_session_auth_hash(request, user)  # <-- цей рядок
    
    return Response({'message': 'Пароль успішно змінено'})
```

## Чи потрібно це для JWT?

**Короткий відповідь:** У нашому проекті — **ні, не критично**, але залишити безпечно.

**Детальніше:**

1. **API використовує JWT** — access token в заголовку `Authorization`, refresh token в HttpOnly cookie. Сесії Django для API-запитів не використовуються.

2. **Сесії використовуються для:**
   - WebSocket (cookie-based auth через `SessionMiddleware` + `AuthMiddleware`)
   - Admin-панель (якщо ввійти через /admin/)
   - Потенційно майбутніх функцій, що покладаються на сесію

3. **Що відбувається без `update_session_auth_hash`:**
   - При зміні пароля сесія інвалідується
   - Якщо користувач мав відкритий WebSocket (чат), він може відключитися, бо сесія більше не валідна
   - Admin-сесія (якщо була) теж інвалідується

4. **Що відбувається з `update_session_auth_hash`:**
   - Поточна сесія залишається валідною
   - WebSocket продовжує працювати
   - Користувач не виходить з системи через сесію

## Примітка: примусове закриття WS при logout

Навіть коли сесія валідна, при **виході з облікового запису** сервер викликає **`broadcast_user_ws_disconnect(user_id)`** (`apps/users/ws_disconnect.py`): подія **`force.disconnect`** у групу **`user_{id}`**. `ChatConsumer` і `CounterConsumer` підписані на цю групу й закривають з’єднання з кодом **4401**, щоб клієнт не лишався в чаті після logout. Це окремо від інвалідації сесії при зміні пароля.

## Висновок

**Залишати `update_session_auth_hash`** — правильний підхід, тому що:
- Не заважає роботі JWT
- Підтримує валідність сесії для WebSocket і admin
- Це рекомендована практика Django при зміні пароля

**Прибрати** можна лише якщо ви впевнені, що сесії ніде не використовуються. У нашому випадку WebSocket використовує сесію, тому рядок потрібен.

## Приклад з документації Django

```python
from django.contrib.auth import update_session_auth_hash

def password_change_view(request):
    if request.method == 'POST':
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            form.save()
            update_session_auth_hash(request, form.user)  # Важливо!
            return redirect('password_change_done')
    ...
```
