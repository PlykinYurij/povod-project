# Проверка регистрации · E1-04 API

Это backend API, не готовая форма кабинета. Принятый UX — автоматический вход после регистрации; сейчас создаётся аккаунт, сессии/автовход добавятся в E1-04b. Адрес PostgreSQL 15432 предназначен SQL-клиенту; Swagger открывается на HTTP-порту API 3001.

При работающем Docker Desktop, из корня:

```powershell
npm ci
node scripts/local-db.mjs up
npm run build --workspace=@povod/api
npm run db:migrate:dev
npm run db:migrate:test
npm run db:seed:test
npm run test:database
npm run dev:api:database
```

Последняя команда запускает Nest с dev URL, собранным из ignored infra/local/.env.local, без вывода connection string. Существующие переменные/пользовательские env не перезаписывает. Порт 3001, при необходимости `$env:PORT='3101'` в текущем PowerShell перед запуском; остановить Ctrl+C. Root `dev:api` остаётся вариантом без загрузки локального DB env: liveness работает, регистрация без DATABASE_URL вернёт 503. В scripts нет системных установок и изменения PATH.

Открыть [Swagger UI](http://127.0.0.1:3001/api/docs/) и [OpenAPI JSON](http://127.0.0.1:3001/api/openapi.json). Snapshot [apps/api/openapi.json](../../apps/api/openapi.json) обновляется через `npm run api:openapi` после build, без БД. Экспортированный JSON упаковывается с SQL/schema/runtime в SHA-kit. Generated Orval руками не пишем: его подключение принадлежит задаче потребителя web.

**POST требует Origin кабинета.** По умолчанию в dev это http://127.0.0.1:3000; Swagger с origin :3001 не пройдёт проверку, это ожидаемо. Для локального Try it out можно перезапустить API с `$env:WEB_ORIGIN='http://127.0.0.1:3001'`, а после ревью убрать эту переменную/вернуть origin web. Swagger UI — dev-инструмент; в production он выключен, если явно не включён ENABLE_OPENAPI=1. Не отправлять реальные личные пароли в тестовый сервер.

Пример PowerShell с синтетическими данными (API уже запущен с dev origin :3000):

```powershell
$registration = @{ email = 'review-owner@example.test'; password = 'Review1!example' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3001/api/v1/auth/register -ContentType application/json -Headers @{ Origin = 'http://127.0.0.1:3000' } -Body $registration
```

Ожидается 201 с user.id/email. Повтор — 409 EMAIL_UNAVAILABLE; неверные поля — 422, лишний role тоже 422. PowerShell при 4xx выбрасывает HTTP-ошибку, не считает её успешным результатом. Созданный review-аккаунт остаётся в dev-БД. Сессии пока нет; это не проверка входа. Для автоматической приёмки используется test:database, которая удаляет только свои случайные синтетические записи.

Пароль: 8–128 печатных ASCII-символов (U+0020–U+007E), буквы только A–Z/a–z, цифры 0–9, спецсимволы вроде !/#. Обязательны минимум A–Z, цифра и спецсимвол. Кириллица, диакритика, emoji, табы и переносы строк запрещены. Пробел не считается спецсимволом, но допускается и не обрезается. Нижняя буква не обязательна. Hash — @node-rs/argon2 2.2.2, Argon2id m=19456 KiB/t=2/p=1, случайная соль, 32-byte output. Native package проверяется в kit на каждой ОС, без install scripts. До production нужны измерения на сервере под ожидаемой нагрузкой; локальный прогон этого не заменяет.

Throttle: dev по умолчанию пробные 5 попыток на IP/15 минут, можно задать REGISTER_RATE_LIMIT. Число ещё не принято владельцем для пилота; production без явного параметра закрывает регистрацию 503. JSON-формы с 422/409 считаются попыткой; Origin/Content-Type отказы и ошибки JSON parser происходят раньше guard. Ответ 429 содержит Retry-After. Хранилище счётчиков локально процессу, сбрасывается при перезапуске, не объединяет инстанции. Proxy headers не доверяются; до реального reverse proxy требуется проверенная trust-proxy/storage-политика, иначе общий адрес proxy разделит одну квоту. Это не разрешение публичного запуска.

Сервер возвращает safe error с requestId, без SQL/stack/password/hash/body. Logger HTTP-запросов выключен, request body не логируется. Origin проверяется точным совпадением, CORS только для него, JSON-only; session-CSRF с bootstrap/token добавится до cookie-auth в E1-04b, а не считается уже реализованным.

Проверено 17.11.2026: [Nest validation](https://docs.nestjs.com/techniques/validation), [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction), [Argon2 binding](https://github.com/napi-rs/node-rs), [OWASP Argon2id](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Правило 8 символов/состав принято владельцем; оно отличается от рекомендации OWASP 15 без MFA, не выдаётся за соответствие этой рекомендации.
