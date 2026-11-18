# Backend регистрации · E1-04 / E1-04b

Текущее поведение ниже: email не подтверждается, аккаунт создаётся сразу. Это рабочая инструкция старого API, который не соответствует новому D-30; исправление [E1-04d](../product/e1-04d.md) ещё не реализовано. Команд подтверждения пока нет.

Базовый E1-04 принят в main `9c0cc4c`. E1-04b расширяет его: регистрация атомарно создаёт аккаунт и Session, автоматически входит и требует CSRF bootstrap. Web-форма ещё не реализована. [Актуальный запуск и ручная приёмка](sessions.md), [QA регистрации](../qa/e1-04-report.md), [QA сессий](../qa/e1-04b-report.md).

Последовательность клиента: GET `/api/v1/auth/csrf` с cookie credentials → POST `/api/v1/auth/register` с JSON email/password, Origin и X-CSRF-Token → 201 `{user:{id,email}}`/session-cookie → GET `/api/v1/auth/session` 200. После смены Session получить новый CSRF перед мутацией. Пример WebSession для PowerShell и Swagger шаги находятся в sessions.md; старый POST без cookie/CSRF больше не поддерживается.

Email trim/lowercase, точки/plus сохранены. Новый пароль 8–128 печатных ASCII-символов: латинские A–Z/a–z, цифры, спецсимволы и обычный пробел. Обязательны A–Z, цифра и спецсимвол; пробел не считается спецсимволом. Без trim/обрезки. Политика не применяется повторно при login старого пароля. Сервер хранит Argon2id, возвращает только безопасный DTO.

Занятый email — 409 EMAIL_UNAVAILABLE, неверные поля/лишний role — 422, отсутствующий Origin/CSRF — 403, неподдерживаемый content type — 415, malformed JSON — 400, большой body — 413, DB/config failure — 503. Лимит register 5/IP/15 минут принят D-29, 429 содержит Retry-After. Подробные server storage/proxy/production ограничения — в sessions.md.

Swagger в local: `/api/docs/`, JSON `/api/openapi.json`; для Try it out задать WEB_ORIGIN API-origin только в local, выполнить bootstrap и вставить X-CSRF-Token. [Snapshot](../../apps/api/openapi.json) регенерировать `npm run api:openapi` после build, не редактировать руками. Production требует отдельный CSRF_SECRET/HTTPS; публичный запуск этим PR не выполняется.
