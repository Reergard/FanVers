🐛 BUG REPORT
iPhone Chrome — пустой отступ снизу при открытии User Menu (drawer mode)
1. Краткое описание проблемы

На iPhone в браузере Google Chrome (iOS) при определённом сценарии возникает визуальный дефект:

После скролла страницы вниз (когда нижняя панель Chrome скрывается), при открытии выпадающего пользовательского меню (drawer mode), между нижней частью экрана и интерфейсом появляется пустой отступ.

Визуально создаётся ощущение, что:

вся страница,

вместе с открытым меню,

“оторвана” от нижней части экрана.

Проблема НЕ воспроизводится:

на Android (Chrome)

на iPhone Safari

на десктопных браузерах

2. Условия воспроизведения
Устройство:

iPhone (тестировалось на iOS + Chrome)

Браузер:

Google Chrome (iOS)

Версия: актуальная

Сценарий воспроизведения:

Загрузить страницу.

Прокрутить страницу вниз так, чтобы нижняя панель Chrome исчезла.

Нажать на кнопку открытия пользовательского меню.

Меню открывается.

Появляется нижняя панель Chrome.

Возникает пустой отступ между интерфейсом и низом экрана.

3. Архитектура компонента
Компоненты, связанные с проблемой:
1️⃣ Header.tsx

Рендерит кнопку пользователя и вызывает:

<UserMenuOverlay />
2️⃣ UserMenuOverlay.tsx

Основная логика выпадающего меню.

Поддерживает два режима:

dropdown

drawer (мобильный режим)

В mobile-режиме используется:

position: fixed;
3️⃣ UserMenuOverlay.module.css

Класс drawer:

.panelDrawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ...
}

Ранее использовались:

height: 100vh

затем 100dvh

затем вычисления через visualViewport

затем вариант без height

Проблема остаётся.

4️⃣ useScrollLock (внутри UserMenuOverlay.tsx)

Используется:

useScrollLock(open);

Этот хук:

блокирует прокрутку body

изменяет position/overflow

потенциально влияет на layout viewport

⚠ Возможная причина бага:
iOS Chrome нестабильно работает при:

position: fixed

body locking

появлении/скрытии bottom bar

5️⃣ main.css (глобальные стили)

Глобальные стили влияют на:

html
body
#root

Нужно проверить:

нет ли height: 100vh

нет ли transform

нет ли overflow:hidden на родителях

6️⃣ Header.module.css

Проверить:

нет ли transform

нет ли contain

нет ли perspective

Любой из этих параметров может ломать position: fixed в iOS.

7️⃣ index.html

Meta viewport:

<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

Важно для safe-area.

4. Что уже пробовалось
❌ height: 100vh

Ломает layout при появлении панели Chrome.

❌ height: 100dvh

Устраняет часть проблемы, но создаёт пустоту в другом сценарии.

❌ Использование visualViewport.height

На iOS Chrome возвращает нестабильные значения.

❌ bottom:0 + height

Конфликтует при изменении viewport.

❌ Удаление height и использование только top/bottom

Проблема сохраняется.

5. Предполагаемые причины
1️⃣ Несоответствие layout viewport и visual viewport

iOS Chrome:

иногда меняет visualViewport

иногда overlay’ит UI поверх layout

иногда меняет размер layout после задержки

Это приводит к:

несовпадению fixed элементов

визуальному "разрыву"

2️⃣ Scroll Lock конфликт

Если body получает:

position: fixed;

или

overflow: hidden;

при открытии drawer —
Chrome может пересчитать layout viewport неправильно.

3️⃣ Dynamic toolbar behaviour (iOS Chrome)

Chrome:

скрывает нижнюю панель при скролле

возвращает её при взаимодействии

иногда не меняет layout viewport

иногда меняет

Это создаёт нестабильное поведение для fixed-элементов.

6. Текущее состояние кода (drawer mode)
.panelDrawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
}

Scroll lock активируется при open=true.

7. Что НЕ используется сейчас

100vh

100dvh

inline height

visualViewport управление

8. Что требуется исправить

Нужно добиться:

drawer всегда прилегает к низу экрана

нет пустоты

нет скачков

нет зависимости от появления нижней панели Chrome

корректная работа scroll lock

одинаковое поведение в:

iOS Chrome

iOS Safari

Android Chrome

9. Возможные направления решения

Переписать scroll lock под iOS-специфичный паттерн.

Использовать body-scroll-lock библиотеку.

Избежать position: fixed на body.

Использовать full-screen overlay через portal вне root.

Использовать transform вместо fixed (внутренний контейнер).

Проверить влияет ли safe-area.

Проверить отсутствие transform на родителях.

10. Визуальное описание дефекта

После открытия меню:

|--------------------|
|                    |
|   CONTENT + MENU   |
|                    |
|                    |
|      (пустота)     |  ← здесь возникает gap
|====================|  ← нижняя панель Chrome
11. Приоритет

Средний.

Функциональность работает, дефект визуальный.