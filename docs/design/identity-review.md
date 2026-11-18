# Проверки макетов identity · E0-02

18.11.2026. Ветка `design/identity-flow` от принятого main `0026548`. [HTML](identity-flow.html), [передача frontend](identity-flow.md). Самопроверка ведущим, не независимый UX-аудит.

Браузер: установленный Chrome, headless/CDP, без установки зависимостей и внешних сервисов. 336 сочетаний: 42 пары экран/состояние × 360/1280 px × light/dark × RU/EN. Во всех проверены отсутствие горизонтального overflow, label у input, отсутствие JS exceptions/сырых ключей переводов и скрытие project cards при expired session. Это DOM/layout-проверки, не 336 индивидуально просмотренных изображений.

Дополнительно в реальном DOM пройдены демонстрационные register → code → кабинет, reset email → code/new password → success → login, resend → status/focus code и переход Tab на кнопку. Проверен focus h1 при смене экрана. Это работа прототипа без API, не E2E приложения.

Снято 8 PNG: пары register/desktop RU и кабинет/desktop EN, code/mobile RU и reset code/mobile EN, в двух темах. Визуально просмотрены desktop light register, mobile dark/light code, mobile light EN reset и desktop dark EN кабинет; текст не обрезан, поля/кнопки и переносы проверены. Уточнены нейтральный resend reset, отдельная ошибка newPassword и вынос implementation notes за продуктовый экран. После уточнений DOM-набор повторён успешно. Четыре опорных снимка сохранены для ревью:

- [Регистрация desktop RU/light](previews/identity-register-desktop.png).
- [Подтверждение mobile RU/dark](previews/identity-code-mobile.png).
- [Новый пароль mobile EN/light](previews/identity-reset-mobile-en.png).
- [Кабинет desktop EN/dark](previews/identity-cabinet-desktop-en.png).

Поля обязательности/ограничения и методы сверены с OpenAPI 0.4.0: register/email/password, confirm/registrationId/code, resend/registrationId; login; reset/email/code/newPassword. Последствия повтора confirm и отсутствие reset autologin сверены с принятыми backend-инструкциями. Соответствие FR/NFR указано в [описании](identity-flow.md).

Проверки ссылок, конфликтных маркеров, синтаксиса inline JS, отсутствия сетевых зависимостей и diff проводятся перед коммитом. Приложение/зависимости/lockfile/инфраструктура не менялись; typecheck/build/backend tests не повторяются для локального HTML. Исходное ТЗ не изменяется.

Не проверены: screen reader, полный WCAG-аудит/инструментальный contrast audit, физические iOS/Android, Safari/Firefox, настоящий API/почта/сессии и безопасность авторизации. Показательный focus/Tab не выдаётся за полную доступность. CSS не доказывает установленный Mantine/next-intl или готовый UI-kit. Нет Figma-переноса.

Статус пакета: Review, owner acceptance и main не отмечены. Родительская E0-02 остаётся открытой для остальных пакетов.

Заключительные проверки: 125 локальных Markdown-путей, inline JS syntax, отсутствие сетевых ресурсов/запросов в HTML, обязательные поля и статусы семи API mutation routes сверены программно с snapshot 0.4.0; четыре PNG валидны. SHA-256 исходного ТЗ неизменён. Эти проверки не заменяют визуальное ревью или интеграцию с API.
