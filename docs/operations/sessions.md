# Вход и сессии · E1-04b

D-30 (18.11.2026): приведённый register пока немедленно авторизует, без email-кода. Это фактическое поведение main, а не целевая приёмка регистрации. После [E1-04d](../product/e1-04d.md) Session должна выдаваться только при подтверждении.

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

Последняя команда — долгоживущий dev API в этом терминале, остановка Ctrl+C; web в этом PR не изменён. PostgreSQL 127.0.0.1:15432 не HTTP. API 127.0.0.1:3001, Swagger `/api/docs/`, JSON `/api/openapi.json`. [Регистрация](registration.md), [миграции](database-migrations.md).

## Ручная проверка автовхода и выхода

В другом PowerShell WebStorm, API уже запущен с default WEB_ORIGIN=http://127.0.0.1:3000:

```powershell
$csrf = Invoke-RestMethod http://127.0.0.1:3001/api/v1/auth/csrf -SessionVariable povodAuthBrowser
$headers = @{ Origin = 'http://127.0.0.1:3000'; 'X-CSRF-Token' = $csrf.csrfToken }
$reviewEmail = 'session-review-' + [guid]::NewGuid().ToString('N') + '@example.test'
$registration = @{ email = $reviewEmail; password = 'Review1!password' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3001/api/v1/auth/register -WebSession $povodAuthBrowser -ContentType application/json -Headers $headers -Body $registration
Invoke-RestMethod http://127.0.0.1:3001/api/v1/auth/session -WebSession $povodAuthBrowser
$csrf = Invoke-RestMethod http://127.0.0.1:3001/api/v1/auth/csrf -WebSession $povodAuthBrowser
$headers['X-CSRF-Token'] = $csrf.csrfToken
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3001/api/v1/auth/logout -WebSession $povodAuthBrowser -ContentType application/json -Headers $headers -Body '{}'
```

Ожидается user.id/email после регистрации и сразу после GET session, без отдельного login. Logout — 204. Следующий GET session в этом WebSession должен дать 401 (PowerShell выдаст HTTP-ошибку, это ожидаемо). Тестовый аккаунт остаётся в dev. Для входа снова получить csrf и сделать POST `/api/v1/auth/login` с теми же email/password; ответ 200 и новая cookie, затем GET session 200.

Эта последовательность проверена PowerShell 5.1/WebSession на отдельном API-порту 3101: регистрация/автовход/refresh CSRF/logout/401 успешны. Синтетический review-аккаунт удалён точным id+email, его Session каскадно; собственное дерево API-процессов остановлено. Использовать только синтетические данные, не печатать WebSession/Cookie/headers/token и не коммитить их. Cookies хранит WebSession, в JSON session token не возвращается.

## Контракт для frontend

1. `GET /api/v1/auth/csrf` с `credentials: include` → `{csrfToken,expiresAt}` и HttpOnly context-cookie.
2. Register/login/logout: JSON, credentials include, `X-CSRF-Token`, точный Origin кабинета. Браузер сам задаёт Origin, приложение его не подменяет. CSRF token хранить в памяти, не в URL/логах/localStorage.
3. Register 201 или login 200 устанавливает новую session-cookie. Получить свежий csrf перед следующей мутацией: предыдущий token привязан к старому состоянию session-cookie.
4. GET session — 200 `{user:{id,email}}` или 401; logout 204 очищает cookie. На CSRF_FAILED получить свежий bootstrap и повторить максимум один раз; сетевой timeout мутации не означает, что операция не произошла. Автоматический retry login/register при неизвестном результате не нужен.

Ошибки: login — 400/413/415 parser/content type, 422 DTO, 401 INVALID_CREDENTIALS, 403 CSRF_FAILED, 429 RATE_LIMITED с Retry-After, 503 SERVICE_UNAVAILABLE; GET session — 401 AUTH_REQUIRED/503. Формат errors/requestId общий, всё auth no-store. [Generated OpenAPI](../../apps/api/openapi.json), `npm run api:openapi` после build; Orval подключается в отдельной web-задаче.

## Хранение и время

Raw session token — 32 случайных байта, cookie в hex; в Session хранится SHA-256, user FK, createdAt/lastSeenAt/expiresAt/revokedAt. Cookie Max-Age 30 дней, даже после закрытия браузера; сервер прекращает доступ ровно при idle >=7 дней или absolute >=30 дней. Активные аутентифицированные запросы обновляют idle монотонно, absolute не меняется. Фоновые HTTP-запросы тоже активность, человеческую активность отдельно не отслеживаем. Это сроки входа, не 90 дней публикации и не срок хранения приглашений/фото/RSVP.

Register создаёт user+Session в одной транзакции; login проверяет hash вне транзакции, затем коротко блокирует User FOR UPDATE, повторно проверяет актуальность hash и создаёт новую Session. Предыдущая cookie браузера отзывается, остальные устройства продолжают работать. E1-04c reset обязан использовать тот же порядок блокировки User и атомарно менять пароль/отзывать все сессии. SessionGuard только аутентифицирует actor: resource use-case дополнительно фильтрует ownerId.

Просроченные Session не дают доступ даже без cron. Физическая очистка по absolute expiry выполняется при создании следующей сессии; idle-expired/revoked записи могут оставаться до absolute cleanup. FK удаляет Session при полном удалении User. Сроки purge аккаунтов/приглашений этим PR не выбираются.

## CSRF и production

Подписанный double-submit: HttpOnly context-cookie плюс HMAC-SHA256 token с expiry и привязкой к session-cookie; timingSafeEqual. Token живёт час, bootstrap не создаёт User/Session/строку в БД. Origin и JSON проверяются отдельно, SameSite — дополнительная защита. После ротации сессии, смены CSRF key или часа ожидания требуется новый bootstrap. GET csrf отклоняет чужой Origin/Sec-Fetch-Site cross-site.

Production: отдельный `CSRF_SECRET` минимум 64 hex-символа из менеджера секретов, общий для API-инстанций; не использовать пароль БД и не выводить secret в чат/команды логов. Без корректного ключа bootstrap/проверка подписей закрыты. В local ключ случайный в памяти приложения: перезапуск инвалидирует только CSRF token, сессии остаются в PostgreSQL. Cookies production называются `__Host-povod-session`/`__Host-povod-csrf`, Secure/HttpOnly/SameSite=Lax/Path=/, без Domain; dev HTTP — имена без prefix/Secure. Проверки флагов не заменяют реальный HTTPS smoke перед dev deploy.

Использовать один и тот же hostname (127.0.0.1 и localhost не смешивать). Для Swagger Try it out на :3001 задать local WEB_ORIGIN=http://127.0.0.1:3001, выполнить getCsrfToken, вставить его в X-CSRF-Token, затем register/login, снова getCsrfToken перед logout. CORS разрешает credentials и X-CSRF-Token только доверенному WEB_ORIGIN, не wildcard/гостевым поддоменам. На публичных guest routes CORS/куки нужно проектировать отдельно, не расширять глобальный credentialed allowlist.

## Лимиты и ограничения

Принято D-29: register 5/IP/15 минут; login 5 неверных/email+IP/15 минут. Нет постоянной блокировки аккаунта, другая пара не блокируется. Login резервирует попытку атомарно до Argon2 verify (пять одновременно проверяемых запросов временно занимают слоты). Неверные credentials оставляют счётчик, успех очищает ошибки, контролируемый серверный сбой освобождает резерв. Если при освобождении сама БД недоступна, release best effort и резерв остаётся до конца окна. Login-окно фиксируется первой попыткой, повторный отказ не продлевает его. В PostgreSQL только digest ключа пары и expiry/count; это псевдонимизация, не анонимизация. Истёкшие счётчики лениво удаляются при следующем входе, точного фонового purge пока нет.

Register использует существующий Nest throttler in-memory: в production ровно 5 (dev override REGISTER_RATE_LIMIT не действует). В local/tests можно уменьшить/увеличить лимит для проверок. Counter register сбрасывается при перезапуске и не общий для нескольких API-инстанций; до публичного multi-instance выпуска нужен общий storage. Login counter общий PostgreSQL и переживает инстанции/рестарт. X-Forwarded-For не доверяется; trust proxy остаётся выключенным. Настройка реального reverse proxy/адреса клиента и shared rate storage — обязательная проверка перед публичным выпуском, не готовый production deploy.

Источники проверены 17.11.2026: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP signed double-submit/CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [cookie package](https://github.com/jshttp/cookie). Конкретные 7/30 дней и 5/15 минут — выбор владельца, не приписываются OWASP.
