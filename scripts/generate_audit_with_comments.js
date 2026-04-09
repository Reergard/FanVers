const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel, PageBreak
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "1F4E79", type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, font: "Arial", size: 18, color: "FFFFFF" })] })],
  });
}

function cell(texts, width, opts = {}) {
  const children = texts.map((t) => {
    if (typeof t === "string") return new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: t, font: "Arial", size: 16 })] });
    return new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: t.text, font: "Arial", size: 16, bold: t.bold, color: t.color, italics: t.italics })] });
  });
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children,
  });
}

function commentCell(lines, width) {
  const children = lines.map((line) => {
    if (typeof line === "string") {
      return new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: line, font: "Arial", size: 15, color: "1A1A1A" })] });
    }
    const runs = [];
    if (line.label) runs.push(new TextRun({ text: line.label, font: "Arial", size: 15, bold: true, color: "C00000" }));
    if (line.text) runs.push(new TextRun({ text: line.text, font: "Arial", size: 15, color: "1A1A1A" }));
    return new Paragraph({ spacing: { after: 30 }, children: runs });
  });
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
    margins: cellMargins,
    children,
  });
}

// Column widths: Cat=1400, File=2200, Problem=3200, Solution=3200, Comment=4400
// Total = 14400 (landscape A4)
const W = [1400, 2200, 3200, 3200, 4400];
const tableWidth = W.reduce((a, b) => a + b, 0);

const rows1 = [
  // Header
  new TableRow({ children: [
    headerCell("Категория", W[0]),
    headerCell("Файл / Место", W[1]),
    headerCell("Проблема", W[2]),
    headerCell("Решение", W[3]),
    headerCell("Комментарии аудита (что/где/как)", W[4]),
  ]}),

  // 1 - CSRF_COOKIE_SAMESITE
  new TableRow({ children: [
    cell([{ text: "Security / HIGH", bold: true, color: "C00000" }], W[0]),
    cell(["settings.py:441-443"], W[1]),
    cell(["CSRF_COOKIE_SAMESITE='None' в проде \u2014 разрешает cross-site передачу cookie"], W[2]),
    cell(["CSRF_COOKIE_SAMESITE='Strict' или 'Lax' в продакшене"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py, строки 441-443" },
      { label: "Сейчас: ", text: "raw = os.getenv('CSRF_COOKIE_SAMESITE', 'None') \u2014 дефолт 'None'" },
      { label: "Сделать: ", text: "Изменить дефолт на 'Lax': os.getenv('CSRF_COOKIE_SAMESITE', 'Lax')" },
      { label: "Важно: ", text: "'Strict' сломает OAuth/redirect flows. 'Lax' \u2014 оптимальный баланс. 'None' допустим ТОЛЬКО если фронт на другом домене И стоит Secure=True." },
      { label: "Нельзя: ", text: "Оставлять 'None' без явной необходимости cross-site запросов." },
    ], W[4]),
  ]}),

  // 2 - SECRET_KEY reuse
  new TableRow({ children: [
    cell([{ text: "Security / HIGH", bold: true, color: "C00000" }], W[0]),
    cell(["settings.py:27,272,383"], W[1]),
    cell(["SECRET_KEY переиспользуется как ключ WebSocket-шифрования и JWT signing key"], W[2]),
    cell(["Использовать отдельные ключи для WS и JWT"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py" },
      { label: "Строка 27: ", text: "SIGNING_KEY = env('SIGNING_KEY', default=SECRET_KEY) \u2014 JWT fallback на SECRET_KEY" },
      { label: "Строка 383: ", text: "'symmetric_encryption_keys': [SECRET_KEY] \u2014 Channels WS шифрование" },
      { label: "Сделать: ", text: "1) В .env добавить WS_ENCRYPTION_KEY=<новый 50+ символов>. 2) В settings.py: WS_ENCRYPTION_KEY = env('WS_ENCRYPTION_KEY'). 3) Строка 383: заменить [SECRET_KEY] на [WS_ENCRYPTION_KEY]. 4) Убедиться что SIGNING_KEY задан явно в .env, не fallback." },
      { label: "Почему: ", text: "Утечка одного ключа компрометирует все три системы. Каждый ключ \u2014 отдельный секрет." },
      { label: "Нельзя: ", text: "Использовать один ключ для JWT, WS и Django sessions." },
    ], W[4]),
  ]}),

  // 3 - Redis without auth
  new TableRow({ children: [
    cell([{ text: "Security / HIGH", bold: true, color: "C00000" }], W[0]),
    cell(["settings.py:297-311"], W[1]),
    cell(["Redis без аутентификации \u2014 Celery, Channels, Cache без пароля"], W[2]),
    cell(["redis://:password@host:port/db во всех настройках"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py, строки 297-311" },
      { label: "Сейчас: ", text: "CELERY_BROKER_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_CELERY}' \u2014 без пароля" },
      { label: "Сделать: ", text: "1) В .env: REDIS_PASSWORD=<strong_password>. 2) В settings.py: REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', ''). 3) Формат URL: f'redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{DB}'. 4) Применить ко всем 3 URL: Celery, Channels (строка 383 CHANNEL_LAYERS), Cache." },
      { label: "Redis: ", text: "В redis.conf: requirepass <password>. Рестартнуть Redis после изменения." },
      { label: "Нельзя: ", text: "Оставлять Redis без пароля если порт доступен из сети. Даже на localhost \u2014 лучше с паролем." },
    ], W[4]),
  ]}),

  // 4 - No CSP
  new TableRow({ children: [
    cell([{ text: "Security / HIGH", bold: true, color: "C00000" }], W[0]),
    cell(["Отсутствует"], W[1]),
    cell(["Нет Content Security Policy (CSP) headers \u2014 усиливает любую XSS-атаку"], W[2]),
    cell(["Добавить django-csp, настроить строгую политику"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py \u2014 MIDDLEWARE и новые переменные" },
      { label: "Сделать: ", text: "1) pip install django-csp. 2) Добавить 'csp.middleware.CSPMiddleware' в MIDDLEWARE. 3) Настроить:" },
      "CSP_DEFAULT_SRC = (\"'self'\",)",
      "CSP_SCRIPT_SRC = (\"'self'\",)  # Без 'unsafe-inline'!",
      "CSP_STYLE_SRC = (\"'self'\", \"'unsafe-inline'\")  # inline стили часто нужны",
      "CSP_IMG_SRC = (\"'self'\", \"data:\", \"https://your-cdn.com\")",
      "CSP_CONNECT_SRC = (\"'self'\", \"wss://fan-vers.com\")  # WebSocket",
      { label: "Важно: ", text: "Начать с CSP_REPORT_ONLY=True, мониторить нарушения, потом включить enforce. Без CSP \u2014 любой XSS получает полный доступ к DOM и cookies." },
    ], W[4]),
  ]}),

  // 5 - CSRF_COOKIE_HTTPONLY
  new TableRow({ children: [
    cell([{ text: "Security", bold: true, color: "E06000" }], W[0]),
    cell(["settings.py:424"], W[1]),
    cell(["CSRF_COOKIE_HTTPONLY=False \u2014 при наличии XSS атакующий украдёт CSRF-токен"], W[2]),
    cell(["CSRF_COOKIE_HTTPONLY=True"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py, строка 424" },
      { label: "Сейчас: ", text: "CSRF_COOKIE_HTTPONLY = False  # JavaScript must have read access" },
      { label: "Внимание: ", text: "Если фронтенд читает CSRF-токен из cookie через JS (axios/fetch header) \u2014 НЕЛЬЗЯ ставить True, иначе CSRF-защита сломается." },
      { label: "Правильное решение: ", text: "Использовать {% csrf_token %} в шаблонах ИЛИ endpoint /api/csrf/ который ставит cookie. Фронт читает токен через Django template или meta-тег, не из cookie напрямую." },
      { label: "Если SPA: ", text: "Оставить False, но ОБЯЗАТЕЛЬНО внедрить CSP для защиты от XSS. CSP \u2014 основная защита в этом случае." },
    ], W[4]),
  ]}),

  // 6 - Admin URL
  new TableRow({ children: [
    cell([{ text: "Security / MEDIUM", bold: true, color: "E06000" }], W[0]),
    cell(["urls.py:7"], W[1]),
    cell(["Django Admin на стандартном /admin/ \u2014 легко обнаружить"], W[2]),
    cell(["Перенести на нестандартный path, добавить IP whitelist"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/urls.py, строка 7" },
      { label: "Сейчас: ", text: "path('admin/', admin.site.urls)" },
      { label: "Сделать: ", text: "1) Изменить на path('manage-xyz123/', admin.site.urls) \u2014 случайный path. 2) В Nginx: location /manage-xyz123/ { allow 1.2.3.4; deny all; proxy_pass ...; }. 3) Добавить django-admin-honeypot на /admin/ \u2014 логирует попытки входа." },
      { label: "Дополнительно: ", text: "Включить 2FA для admin (django-otp). Ограничить is_staff пользователей." },
      { label: "Нельзя: ", text: "Оставлять /admin/ без IP-ограничений на проде." },
    ], W[4]),
  ]}),

  // 7 - RequireAuth
  new TableRow({ children: [
    cell([{ text: "Auth / MEDIUM", bold: true, color: "E06000" }], W[0]),
    cell(["App.tsx (роутер)"], W[1]),
    cell(["RequireAuth обёртка не используется. Protected routes полагаются на runtime useAuth()"], W[2]),
    cell(["Обернуть protected routes в <RequireAuth>"], W[3]),
    commentCell([
      { label: "Файл: ", text: "frontend/src/App.tsx" },
      { label: "Сейчас: ", text: "RequireAuth.tsx существует (frontend/src/auth/RequireAuth.tsx), но НЕ ИМПОРТИРУЕТСЯ и не оборачивает ни один route. Компонент \u2014 мёртвый код." },
      { label: "Сделать: ", text: "В App.tsx импортировать RequireAuth. Обернуть routes: /profile, /bookmarks, /my-translations, /chat, /messages, /books/:slug/settings, /create-book. Пример: <Route element={<RequireAuth />}><Route path='/profile' .../></Route>" },
      { label: "Как работает: ", text: "RequireAuth проверяет auth и делает refresh перед рендером. Без него \u2014 компонент рендерится, потом проверяет auth \u2014 мелькание UI, утечка данных." },
      { label: "Нельзя: ", text: "Полагаться только на useAuth() внутри компонентов \u2014 это client-side проверка после рендера." },
    ], W[4]),
  ]}),

  // 8 - print() in chat views
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["chat/api/views.py: 54,55,62,105, 111,117,175"], W[1]),
    cell(["print() в продакшен-коде чата \u2014 засоряет stdout"], W[2]),
    cell(["Заменить print() на logger.debug() / logger.error()"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/chat/api/views.py" },
      { label: "Найдено: ", text: "7 print() вызовов (строки 54, 55, 62, 105, 111, 117, 175)" },
      { label: "Сделать: ", text: "1) Вверху файла: import logging; logger = logging.getLogger(__name__). 2) Заменить: print(f'Create chat...') \u2192 logger.debug('Create chat request from user: %s', request.user). 3) Строки 117, 175 (ошибки): logger.error('Error creating chat: %s', e, exc_info=True)" },
      { label: "Формат: ", text: "Использовать %s подстановку (ленивое форматирование), НЕ f-строки в logger." },
      { label: "Нельзя: ", text: "Оставлять print() в проде \u2014 нет уровней, ротации, структуры." },
    ], W[4]),
  ]}),

  // 9 - Blacklist refresh token
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["users/api/views.py: 443-454"], W[1]),
    cell(["Ошибка blacklist refresh-токена: старый токен может остаться валидным"], W[2]),
    cell(["Перевести в exception, логировать как ERROR"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/users/api/views.py, строки 443-454" },
      { label: "Сейчас: ", text: "Код УЖЕ ИСПРАВЛЕН \u2014 при ошибке blacklist() возвращается HTTP 500 и новые токены НЕ выдаются. logger.error() уже используется." },
      { label: "Статус: ", text: "\u2705 РЕШЕНО. Текущая реализация корректна: try/except \u2192 logger.error(..., exc_info=True) \u2192 return Response(500)." },
      { label: "Рекомендация: ", text: "Дополнительно: добавить мониторинг/алерт на этот error, т.к. частые ошибки blacklist могут указывать на проблему с Redis или race condition." },
    ], W[4]),
  ]}),
];

const rows2 = [
  // Header for table 2
  new TableRow({ children: [
    headerCell("Категория", W[0]),
    headerCell("Файл / Место", W[1]),
    headerCell("Проблема", W[2]),
    headerCell("Решение", W[3]),
    headerCell("Комментарии аудита (что/где/как)", W[4]),
  ]}),

  // 10 - get_translators_list
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["users/api/views.py:819-821"], W[1]),
    cell(["get_translators_list() без явного @permission_classes"], W[2]),
    cell(["Добавить @permission_classes([IsAuthenticated])"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/users/api/views.py, строки 819-821" },
      { label: "Сейчас: ", text: "@permission_classes([AllowAny]) \u2014 список переводчиков доступен всем, включая анонимов" },
      { label: "Решение зависит от бизнес-логики: ", text: "Если список переводчиков \u2014 публичная информация (каталог), AllowAny допустим. Если нет \u2014 заменить на [IsAuthenticated]." },
      { label: "Сделать: ", text: "1) Определить: должен ли аноним видеть переводчиков? 2) Если нет: @permission_classes([IsAuthenticated]). 3) В любом случае: добавить пагинацию и rate-limiting чтобы предотвратить scraping." },
    ], W[4]),
  ]}),

  // 11 - save_message without transaction
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["chat/consumers.py: 127-141"], W[1]),
    cell(["save_message() без @transaction.atomic \u2014 частичное сохранение"], W[2]),
    cell(["Обернуть в transaction.atomic()"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/chat/consumers.py, строки 127-141" },
      { label: "Сейчас: ", text: "@database_sync_to_async def save_message() \u2014 Message.objects.create() без транзакции" },
      { label: "Сделать: ", text: "from django.db import transaction. Внутри функции: with transaction.atomic(): chat = Chat.objects.select_for_update().get(id=chat_id); message = Message.objects.create(...). Декоратор @database_sync_to_async оставить." },
      { label: "Почему select_for_update: ", text: "Предотвращает race condition при одновременной отправке. Без atomic \u2014 сообщение сохранится, но связанные операции (counter, last_message) могут не обновиться." },
      { label: "Нельзя: ", text: "Использовать @transaction.atomic как декоратор вместе с @database_sync_to_async \u2014 только with transaction.atomic() внутри функции." },
    ], W[4]),
  ]}),

  // 12 - CONN_MAX_AGE
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["settings.py (DATABASES)"], W[1]),
    cell(["Нет CONN_MAX_AGE для DB \u2014 может исчерпать пул"], W[2]),
    cell(["CONN_MAX_AGE = 60 в DATABASES"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/FanVers_project/settings.py, блок DATABASES (строки 336-353)" },
      { label: "Сейчас: ", text: "CONN_MAX_AGE не задан \u2014 Django по умолчанию = 0 (новое соединение на каждый запрос)" },
      { label: "Сделать: ", text: "В блок DATABASES['default'] добавить: 'CONN_MAX_AGE': int(os.getenv('CONN_MAX_AGE', '60'))" },
      { label: "Для Channels/WS: ", text: "WebSocket-соединения долгоживущие. CONN_MAX_AGE=60 переиспользует DB-соединения вместо создания новых. Для WS-workers рекомендуется CONN_MAX_AGE=0 или close_old_connections() вручную." },
      { label: "Нельзя: ", text: "Ставить CONN_MAX_AGE=None (бессрочное) \u2014 мёртвые соединения не будут закрываться." },
    ], W[4]),
  ]}),

  // 13 - chatWs.ts error parsing
  new TableRow({ children: [
    cell([{ text: "Reliability", bold: true, color: "0070C0" }], W[0]),
    cell(["chatWs.ts:117"], W[1]),
    cell(["Ошибки парсинга WS-сообщений проглатываются молча"], W[2]),
    cell(["Добавить логирование в catch блок"], W[3]),
    commentCell([
      { label: "Файл: ", text: "frontend/src/chat/ws/chatWs.ts, строка 117" },
      { label: "Сейчас: ", text: "catch { // Skip malformed ws frames... } \u2014 пустой catch" },
      { label: "Сделать: ", text: "catch (err) { if (import.meta.env.DEV) console.warn('[chatWs] malformed frame:', err, event.data); }" },
      { label: "Аналогично: ", text: "frontend/src/chat/ws/counterWs.ts, строка 123 \u2014 такой же пустой catch. Добавить то же логирование." },
      { label: "Нельзя: ", text: "Логировать event.data в прод \u2014 может содержать PII. Только в DEV режиме." },
    ], W[4]),
  ]}),

  // 14 - console.error without DEV gate
  new TableRow({ children: [
    cell([{ text: "Security", bold: true, color: "E06000" }], W[0]),
    cell(["refreshCore.ts:38, service.ts:71,117"], W[1]),
    cell(["console.error без DEV-гейта попадает в прод"], W[2]),
    cell(["Обернуть в if(import.meta.env.DEV)"], W[3]),
    commentCell([
      { label: "Файлы и строки:" },
      "\u2022 frontend/src/auth/refreshCore.ts:38 \u2014 console.error('[refreshCore] refresh error'...)",
      "\u2022 frontend/src/auth/service.ts:71 \u2014 console.error('[service] login error'...)",
      "\u2022 frontend/src/auth/service.ts:117 \u2014 console.error('[service] register error'...)",
      "\u2022 frontend/src/auth/csrf.ts:23 \u2014 console.error('[csrf.ts] Error'...)",
      "\u2022 frontend/src/auth/authSelfTest.ts:66 \u2014 console.error('[authSelfTest]'...)",
      "\u2022 frontend/src/shared/MenuList/MenuList.tsx:25 \u2014 console.error('Logout error'...)",
      { label: "Сделать: ", text: "Каждый console.error обернуть: if (import.meta.env.DEV) console.error(...). Или создать утилиту: export const devError = (...args) => { if (import.meta.env.DEV) console.error(...args); };" },
      { label: "Почему: ", text: "В проде console.error раскрывает внутреннюю структуру ошибок, имена переменных, URL эндпоинтов \u2014 помогает атакующему." },
    ], W[4]),
  ]}),

  // 15 - chatWs reconnect without authStatus
  new TableRow({ children: [
    cell([{ text: "Security", bold: true, color: "E06000" }], W[0]),
    cell(["chatWs.ts (reconnect)"], W[1]),
    cell(["Reconnect не проверяет authStatus() \u2014 retry loop при отозванном токене"], W[2]),
    cell(["Перед reconnect проверять authStatus()"], W[3]),
    commentCell([
      { label: "Файл: ", text: "frontend/src/chat/ws/chatWs.ts, строки 131-150 (onclose handler)" },
      { label: "Сейчас: ", text: "Reconnect проверяет только shouldReconnect и targetChatId. Exponential backoff до 60с, но auth не проверяется." },
      { label: "Сделать: ", text: "1) Импортировать проверку auth статуса. 2) В onclose перед scheduleReconnect: const isAuth = await checkAuthStatus(); if (!isAuth) { this.shouldReconnect = false; return; }. 3) Аналогично в counterWs.ts." },
      { label: "Почему: ", text: "При отозванном/expired токене WS будет бесконечно переподключаться с 401, создавая нагрузку на сервер и утечку информации о сессии." },
      { label: "Нельзя: ", text: "Делать reconnect без проверки auth \u2014 это по сути DDoS собственного сервера." },
    ], W[4]),
  ]}),

  // 16 - NotificationViewSet
  new TableRow({ children: [
    cell([{ text: "Security", bold: true, color: "E06000" }], W[0]),
    cell(["notification/api/ views.py:12-132"], W[1]),
    cell(["NotificationViewSet без object-level permission"], W[2]),
    cell(["Добавить get_object() override с проверкой obj.user"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/notification/api/views.py" },
      { label: "Сейчас: ", text: "permission_classes=[IsAuthenticated]. Object-level проверки (notification.user != request.user) есть в mark_as_read (стр.74-79) и destroy (стр.96-101), но реализованы inline." },
      { label: "Сделать: ", text: "1) Создать class IsOwner(BasePermission): def has_object_permission(self, request, view, obj): return obj.user == request.user. 2) В ViewSet: permission_classes = [IsAuthenticated, IsOwner]. 3) Удалить inline проверки из mark_as_read и destroy. 4) Переопределить get_object() для вызова check_object_permissions()." },
      { label: "Почему: ", text: "DRF permission \u2014 единая точка проверки. Inline проверки легко забыть при добавлении новых action-методов." },
    ], W[4]),
  ]}),

  // 17 - ROTATION_DETECTED dead code
  new TableRow({ children: [
    cell([{ text: "Code Quality", bold: true, color: "666666" }], W[0]),
    cell(["auth/authLogger.ts:15"], W[1]),
    cell(["ROTATION_DETECTED \u2014 мёртвый код в authLogger"], W[2]),
    cell(["Удалить неиспользуемое событие"], W[3]),
    commentCell([
      { label: "Файл: ", text: "frontend/src/auth/authLogger.ts, строка 15" },
      { label: "Сейчас: ", text: "ROTATION_DETECTED в типе AuthEvent, но нигде не вызывается authLog('ROTATION_DETECTED')" },
      { label: "Сделать: ", text: "Удалить '| \"ROTATION_DETECTED\"' из типа AuthEvent. Поиск: grep -r 'ROTATION_DETECTED' \u2014 убедиться что нигде не используется." },
      { label: "Важно: ", text: "Проверить git blame \u2014 возможно планировалась ротация токенов. Если не планируется \u2014 удалить." },
    ], W[4]),
  ]}),

  // 18 - Double cache HTML
  new TableRow({ children: [
    cell([{ text: "Bug", bold: true, color: "C00000" }], W[0]),
    cell(["catalog/models.py: 576-597 (save)"], W[1]),
    cell(["Двойной кэш HTML (БД + диск) \u2014 могут рассинхронизироваться"], W[2]),
    cell(["Использовать единственный источник истины"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/catalog/models.py, метод save() строки 576-597" },
      { label: "Сейчас: ", text: "html_content хранится в поле модели (БД). Если есть дисковый кэш \u2014 два источника истины." },
      { label: "Сделать: ", text: "Оставить ТОЛЬКО БД как источник. Удалить запись на диск. Если нужен кэш для производительности \u2014 использовать Django cache framework (Redis) с инвалидацией при save()." },
      { label: "Паттерн: ", text: "В save(): super().save(...); cache.delete(f'chapter_html_{self.pk}'). В get_html(): return cache.get_or_set(f'chapter_html_{self.pk}', self.html_content, 3600)" },
      { label: "Нельзя: ", text: "Хранить один и тот же контент в двух местах без механизма синхронизации." },
    ], W[4]),
  ]}),

  // 19 - character_count counts HTML
  new TableRow({ children: [
    cell([{ text: "Bug", bold: true, color: "C00000" }], W[0]),
    cell(["catalog/models.py:587"], W[1]),
    cell(["character_count считает HTML-символы, не текст читателя"], W[2]),
    cell(["len(strip_tags(html_content))"], W[3]),
    commentCell([
      { label: "Файл: ", text: "backend/apps/catalog/models.py, строка 587" },
      { label: "Сейчас: ", text: "self.character_count = len(self.html_content) \u2014 считает <p>, <b>, &nbsp; и т.д." },
      { label: "Сделать: ", text: "from django.utils.html import strip_tags; import re; clean = strip_tags(self.html_content); clean = re.sub(r'\\s+', ' ', clean).strip(); self.character_count = len(clean); self.characters_count = self.character_count" },
      { label: "Влияние: ", text: "reading_time (строка 590) тоже считается от character_count. После исправления время чтения станет корректным." },
      { label: "Нельзя: ", text: "Использовать BeautifulSoup для strip_tags \u2014 Django strip_tags() достаточно и быстрее. Не забыть &nbsp; \u2014 strip_tags не удаляет HTML entities, нужен html.unescape() перед strip." },
    ], W[4]),
  ]}),

  // 20 - No skeleton for chapter loading
  new TableRow({ children: [
    cell([{ text: "UX", bold: true, color: "666666" }], W[0]),
    cell(["ChapterDetail Router.tsx:140"], W[1]),
    cell(["Нет skeleton/spinner при загрузке глав"], W[2]),
    cell(["Добавить skeleton компонент"], W[3]),
    commentCell([
      { label: "Файл: ", text: "frontend/src/catalog/ChapterDetailRouter.tsx, строка 140" },
      { label: "Сейчас: ", text: "if (!authReady || chapterQ.isLoading) return <div>\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F \u0440\u043E\u0437\u0434\u0456\u043B\u0443...</div>" },
      { label: "Сделать: ", text: "Заменить на Skeleton компонент: 1) Создать ChapterSkeleton \u2014 серые блоки имитирующие layout главы (заголовок + 10-15 строк текста). 2) Использовать CSS animation: pulse/shimmer. 3) return <ChapterSkeleton /> вместо текста." },
      { label: "Минимум: ", text: "Если skeleton сложно \u2014 хотя бы добавить Spinner по центру с текстом. Текущий plain div выглядит сломанным." },
    ], W[4]),
  ]}),

  // 21 - No WS status indicator
  new TableRow({ children: [
    cell([{ text: "UX", bold: true, color: "666666" }], W[0]),
    cell(["Фронтенд чат"], W[1]),
    cell(["Нет визуального индикатора статуса WS-соединения"], W[2]),
    cell(["Добавить status badge в UI чата"], W[3]),
    commentCell([
      { label: "Файлы: ", text: "frontend/src/chat/ChatPage.tsx, frontend/src/chat/ws/chatWs.ts" },
      { label: "Сейчас: ", text: "chatWs молча fallback на HTTP при потере WS. Пользователь не знает что соединение потеряно." },
      { label: "Сделать: ", text: "1) В chatWs.ts добавить EventEmitter для статуса: 'connected' | 'reconnecting' | 'disconnected'. Эмитить в onopen, onclose, при reconnect. 2) Хук useChatStatus() подписывается на события. 3) В ChatPage: маленький badge/dot: зелёный=connected, жёлтый=reconnecting, красный=disconnected." },
      { label: "Важно: ", text: "Показывать 'reconnecting' только после 2-3 секунд, не на каждый разрыв \u2014 избежать мелькания при кратковременных потерях." },
    ], W[4]),
  ]}),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 200, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 160, after: 120 }, outlineLevel: 1 } },
    ]
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 16838, height: 11906, orientation: "landscape" },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "АУДИТ БЕЗОПАСНОСТИ \u2014 РЕЗУЛЬТАТЫ + КОММЕНТАРИИ", bold: true })] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Проект: FanVers  |  Дата аудита: 09.04.2026  |  Жёлтый столбец \u2014 детальные комментарии с указанием файлов, строк и конкретных действий", font: "Arial", size: 18, color: "555555" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "ПАТТЕРН: Небезопасная конфигурация продакшена (Таблица 1)" })] }),

        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: W,
          rows: rows1,
        }),

        new Paragraph({ children: [new PageBreak()] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "ПАТТЕРН: Небезопасная конфигурация продакшена (Таблица 2)" })] }),

        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: W,
          rows: rows2,
        }),

        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "\u2139 Все комментарии основаны на реальном анализе кода проекта. Номера строк актуальны на 09.04.2026.", font: "Arial", size: 16, italics: true, color: "888888" })] }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("C:/Users/user/Desktop/3_audit_with_comments.docx", buffer);
  console.log("OK: C:/Users/user/Desktop/3_audit_with_comments.docx");
});
