# E1-04b · Первая web-часть identity

Web login/logout/навигация приняты владельцем вместе с signup/reset в main eb9bc34 (PR #21, код до 5590ea9). Ниже история выполнения; resource owner check будущих проектов остаётся E2-02.

Ветка `feat/web-sign-in` от main `d19e115`, после принятого дизайн-пакета E0-02. Один PR в рамках существующего E1-04b, не закрытие всего identity. FR-03/NFR-01/06/07/14; [макеты](../design/identity-flow.md), [backend](../architecture/authentication.md), [ролевой план](../../apps/web/development-plan.md).

Продолжение по новому поручению владельца: [signup/code и reset на той же ветке](e1-04-identity-web.md). Описание ниже — границы первоначальной login-части, не актуальное утверждение отсутствия этих форм.

Результат: `/login`, `/account`, настоящий login/session/logout, client guard без private данных в anonymous HTML, светлая/тёмная тема, RU/EN, Mantine/shared/ui, next-intl, Orval/TanStack Query. Каркас лендинга остаётся прежним; регистрация с кодом, reset UI, admin, проекты, приглашения и Zustand не входят. Ссылки на ещё не реализованные формы не изображаются работающими.

Уточнение владельца по review: главная получает явный CTA кабинета; авторизованный `/login` направляет в account; неавторизованный private route — на login с безопасным returnTo и возвратом после входа; logout — непосредственно login. Регистрация с кодом в UI остаётся следующей задачей, готовый backend не выдаётся за готовую форму.

Зависимости: принятые API/макеты и точные pins. Владелец явно разрешил next-intl 4.15.1 с известным риском picomatch для локальной разработки, проверок, commit/push ветки. Production этим не разрешён; решение D-33. Исследовательская 4.5.8 отклонена и удалена из итогового pin.

Приёмка:

- Валидный вход → account с текущим email; unknown email/wrong password → единый 401 message, без disclosure. Loading, 422 fields, 429 Retry-After, 403/503/network failure понятны, без ложного успеха.
- При login/logout private queries сначала отменены, затем удалены; поздний ответ A не наполняет cache B. Mutation variables с паролем очищаются после запроса. Auth token только HttpOnly cookie.
- Приватная оболочка не показывает старые данные при 401/ошибке проверки. Logout с неясным результатом скрывает private содержимое и предлагает повтор, не сообщает об успешном завершении сеанса.
- Orval генерирует DTO/methods/hooks; повтор generation без diff. Server entry не импортирует hooks, серверные cookies не глобальны. Runtime ошибок и доверенного API origin проверен.
- Desktop/mobile 360, RU/EN, темы, focus/keyboard; реальный browser + API/PG путь двух owners. Negative UI fixtures отмечены как симуляция, не server proofs.
- Types/build/format, 13 unit и прежние 52 DB/HTTP tests; existing CI добавляет web tests и проверку generated client. Artifact builder учитывает manifest нового workspace, isolated build/runtime проверяется перед публикацией.
- Требование понятного поддерживаемого кода записано в root/web/API AGENTS: предметные имена, небольшие ответственности, явные типы, ошибки, переиспользование по потребителю без абстракций заранее.

Статус: **Review**; финальные локальные проверки на разрешённом pin успешны. Принятие всего результата владельцем/main отдельно, production не разрешён.
