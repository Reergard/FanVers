1) Стек и формат файлов

Vite + React + TypeScript

Компоненты с JSX → .tsx

Логика без JSX (api, types, helpers) → .ts

.jsx не используем (чтобы не смешивать и не терять типы)

2) Структура проекта и ответственность папок
src/
  api/            # axios (http.ts, httpRaw.ts), endpoints, catalogApi
  app/            # общий layout приложения: Base.tsx + Base.module.css
  auth/           # авторизация: store, service, useAuth, bootstrap, token, refresh
  catalog/        # страница книги: BookDetailRouter, BookDetailLayout, sections
  main/           # страницы/фичи главной (HomePage.tsx + стили + локальные картинки)
  users/          # страницы/фичи пользователей (Profile.tsx, profileService, types)
  website_advertising/  # реклама книг (AdvertisingBooks, BookAdCard)
  shared/         # переиспользуемые "примитивы": Container, Icon, Modal, hooks, utils
  widgets/        # крупные блоки: header, footer (и дальше: sidebar, drawer и т.д.)
  assets/         # глобальные ассеты: icons, logos, backgrounds, fonts
  docs/           # документация (Concept.md, STRUCTURE.md, AUTHENTICATION_FRONTEND.md и др.)

Правило: всё "глобальное" → assets/, всё "только для страницы" → feature/assets/.

Авторизация: auth/store (status, user), auth/useAuth (subscribeAuth), bootstrap → refresh → authStatus. Детали: docs/AUTHENTICATION_FRONTEND.md, docs/USER_DATA_FLOW.md.

3) Base layout (обёртка приложения)

app/Base.tsx — это "каркас":

SvgSprite (глобальный спрайт иконок)

ScrollIndicator (кастомный индикатор прокрутки)

фиксированный фон (слои/градиенты)

Header

<main>{children}</main> — сюда подставляются страницы

Footer

Нюанс: Base не выбирает страницы, он просто рендерит children.
Выбор страницы делает роутер (в App.tsx).

4) Global CSS vs CSS Modules
Global (src/main.css)

Используется только для:

:root CSS-переменные (токены)

@font-face (глобально!)

reset/нормализация (box-sizing, body margin, img display:block, т.п.)

базовый fallback background для body

CSS Modules (*.module.css)

Используются для:

стилей конкретного компонента/страницы

локальные классы (чтобы не конфликтовать)

Правило: дизайн и компоненты → modules, глобальные правила и шрифты → main.css.

5) CSS-токены (переменные)

В :root храним:

--container-max (например 1280)

--gutter через clamp() (адаптивные поля)

--text, --muted и т.п.

Зачем:

единый контроль цветов/отступов

менять дизайн централизованно

проще поддерживать адаптив

6) Container (центральная колонка)

shared/Container.tsx — "центрирование":

max-width: var(--container-max) (1280px, на 4K — 1680px)

margin-inline: auto

padding-inline: var(--gutter) через clamp() с --vwu (ограничение vw на больших экранах)

Поддерживает prop `as` для выбора тега (div, section, header, footer)

Важно: Container не обязателен "везде".
Используется точечно там, где контент должен быть в колонке.
Full-width секции (hero/читатель/фоновые блоки) могут быть без Container.

7) Адаптив: брейкпоинты и подход

План:

= 1440 — большие мониторы (больше воздуха)

= 1280 — основной laptop layout (1366/1280 сюда)

< 1024 — tablet (включая iPad 1024)

< 768 — большие телефоны/малые планшеты

< 480 — узкие телефоны

Подход: mobile/tablet меняют структуру (бургер, упрощение), desktop/laptop — полный хедер.

8) Header: структура 2-уровневая

Хедер делится на:

TOP: поиск + логотип + уведомления/сообщения/юзер

NAV: строка ссылок (остаётся видимой и на мобиле; на <480 — горизонтальный скролл)

Layout внутри TOP: grid-template-columns: 1fr auto 1fr (лево/лого/право).
На узких экранах скрываем часть элементов (searchInput), включаем бургер.

9) Drawer/Dropdown меню (единый источник данных)

Концепция:

одно меню по данным

две кнопки открытия

desktop: стрелка возле ника → компактный dropdown

mobile: бургер → drawer/overlay

На mobile меню = USER_MENU + NAV_MENU, на desktop = только USER_MENU

Нюанс: данные меню — один массив (single source of truth), рендер — разный.

10) Формы (input) “как в дизайне”, но нативные

Принцип:

никогда не делаем фейковый input

оставляем <input>, а дизайн рисуем оболочкой (label/div)

используем :focus-within для реакции рамки/линии

Пример паттерна:

label сверху (текст)

underline снизу (border-bottom)

input прозрачный без рамки

11) Иконки и SVG

План/правило:

один набор иконок в public/sprite.svg (глобальный спрайт)

SvgSprite компонент (shared/SvgSprite.tsx) загружает спрайт один раз в Base

Icon компонент (shared/Icon.tsx) использует <use href="#icon-name" /> для рендера иконок

декор-SVG (драконы/фоновые) — в assets/backgrounds/ (например, menu_line.svg)

Нюанс: отдельные картинки (png/jpg/webp) для контента — не в спрайт, импортируются напрямую.

12) Шрифты: политика и нюансы

Цель: использовать WOFF2, потому что:

меньше вес

быстрее загрузка

оптимально для web

Реальный нюанс:

декоративные “free fonts” часто не имеют кириллицы/укр (выявилось на “Пошук…”)

если шрифт нужен именно с UA — ищем версию с Cyrillic/UA или конвертируем из TTF/OTF в WOFF2

Правило подключения:

@font-face только в main.css

путь относительно main.css: ./assets/fonts/...

font-display: swap включен

13) Картинки: оптимизация и “не грузим оригиналы”

План:

на карточках/каталоге не грузить “оригинал 2000px”

использовать srcSet + sizes

для списков: loading="lazy", decoding="async"

14) Routing (как страницы реально переключаются)

Реализовано в App.tsx:

react-router-dom (BrowserRouter, Routes, Route)

Base оборачивает Routes, Routes содержит Route для каждой страницы

Текущие маршруты: "/" (HomePage), "/profile" (Profile), "/books/:slug" (BookDetailRouter)

Перед роутером — bootstrap auth (bootstrapAuth), затем QueryClientProvider, NotificationProvider

Важно: Base оборачивает одну страницу за раз, роутер выбирает какую.

15) Производительность: code-splitting

Реализовано для Profile и BookDetailRouter:

React.lazy + Suspense — уменьшает стартовый бандл

HomePage загружается сразу, Profile и BookDetailRouter — лениво

16) Shared компоненты и утилиты

shared/Icon.tsx — компонент для рендера иконок из спрайта
shared/FrameLink.tsx — стилизованная ссылка с рамкой для навигации
shared/MenuPanel.tsx — панель меню с аватаром и списком
shared/MenuList.tsx — список пунктов меню
shared/AvatarOrbit.tsx — аватар с орбитой (декор)
shared/ScrollIndicator/ — кастомный индикатор прокрутки (overlay)
shared/Modal/ — модальное окно
shared/NotificationModal/ — уведомления (toast)
shared/NotificationProvider.tsx — провайдер контекста уведомлений
shared/ActionButton/ — стилизованная кнопка
shared/utils/errorUtils.ts — утилиты для ошибок
shared/hooks/useMedia.ts — хук для медиа-запросов
shared/hooks/useScrollLock.ts — хук для блокировки скролла (iOS-safe)
shared/menu/menuData.ts — единый источник данных для меню (USER_MENU, NAV_MENU)

17) Общие правила верстки, чтобы не было "топорно"

Grid/Flex — для раскладки блоков (кто слева/справа, колонки, зоны)

Внутри блоков — обычные CSS свойства (типографика, отступы, цвета)

Не фиксировать высоты без необходимости: лучше padding + min-height

Размеры и отступы лучше через clamp() (адаптив "плавно", без ломания)

18) Адаптив для больших экранов (4K)

В main.css и Base.module.css есть специальные правила для экранов >= 2560px:

увеличение базового font-size

zoom: 1.15 для body (fallback через font-size если zoom не поддерживается)

увеличение padding-block в main

Container увеличивает max-width до 1680px

19) ScrollIndicator (кастомный индикатор прокрутки)

Реализован как overlay (не влияет на layout)

Управляется через CSS-переменные (--si-visible, --si-thumb-top, --si-thumb-height)

Автоматически скрывается, если контент не требует скролла

Активное состояние при скролле (is-scrolling класс на html)

Поддержка prefers-reduced-motion