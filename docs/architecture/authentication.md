# Регистрация, аутентификация и права

Backend E1-04 принят в main `9c0cc4c`; E1-04b — реализация для Review, не готовая web-форма или production release. Основания: FR-02–04/NFR-07, D-02/27/28/29 из [решений](../product/decisions.md). [OpenAPI 0.2.0](../../apps/api/openapi.json), [запуск/контракт сессий](../operations/sessions.md), [QA](../qa/e1-04b-report.md).

## Правила и подход

Email trim/lowercase, точки/plus сохраняются, SQL unique. Новые пароли: 8–128 печатных ASCII-символов, минимум A–Z, цифра и спецсимвол; обычный пробел допустим, но не спецсимвол, без trim. Argon2id (@node-rs/argon2 2.2.2, m=19456 KiB/t=2/p=1), случайная соль. Login проверяет полный введённый пароль, не применяет заново правила состава к старым credentials. Роль/ownerId не принимаются из payload. User/passwordHash не возвращается целиком из ORM.

Register атомарно создаёт user+Session, автоматически входит. Подтверждение email после входа не требуется, verify-email не скрытый барьер. Это не доказывает владение адресом: доступ к ящику нужен для reset. Явный 409 занятого email принят D-28 и раскрывает наличие аккаунта.

D-29: вход сохраняется после закрытия браузера; idle 7 дней без аутентифицированных HTTP-запросов, absolute 30 дней с выдачи. При равенстве границе доступ закрыт; активность не продлевает absolute. Это сроки входа, не 90 дней публикации/хранение RSVP.

## /api/v1/auth

| Метод | Вход | Результат |
| --- | --- | --- |
| GET `/csrf` | Необязательные context/session cookies | 200 `{csrfToken,expiresAt}`, HttpOnly context-cookie; нет авторизованной Session/DB-строки |
| POST `/register` | JSON email/password, Origin/CSRF | 201 `{user:{id,email}}`, новая session-cookie; 409 EMAIL_UNAVAILABLE, 422 VALIDATION_FAILED |
| POST `/login` | JSON email/password, Origin/CSRF | 200 user и новая cookie, прежняя cookie браузера отозвана; одинаковый 401 INVALID_CREDENTIALS для неизвестного email/неверного пароля |
| GET `/session` | Session-cookie | 200 user текущей Session или 401 AUTH_REQUIRED; токен не возвращается |
| POST `/logout` | Origin/CSRF, необязательная session-cookie | 204, текущая Session отозвана, cookie очищена; повтор/истёкшая/anonymous также 204 при валидном CSRF |

Всё auth no-store. Общие: 400 malformed JSON, 413 body limit, 415 content type, 422 DTO, 403 CSRF_FAILED, 429 RATE_LIMITED/Retry-After, 503 SERVICE_UNAVAILABLE. Формат errors/requestId — [API](api-contract.md). Не логировать пароли/hash/cookie/CSRF/reset URL/request bodies.

## Cookie/CSRF/доступ

Session token — 32 случайных байта, в PostgreSQL только SHA-256 и lifecycle. Host-only cookie, Path=/, HttpOnly, SameSite=Lax, Max-Age 30 дней. Production Secure/__Host-prefix/без Domain; local HTTP — отдельные имена без Secure/prefix. Нет JWT/refresh token в localStorage или bearer в JSON. Вход выдаёт новый token, не повышает pre-auth context до Session.

Signed double-submit: случайная HttpOnly context-cookie, HMAC-SHA256 с context/session-cookie/expiry, constant-time проверка. CSRF живёт час; после смены session-cookie/key получить bootstrap. Это техническая настройка, не новый session TTL. Production CSRF_SECRET из secret storage, local key в памяти. Origin/JSON/CORS дополняют SameSite; credentials только для WEB_ORIGIN кабинета, не гостевых поддоменов.

Register создаёт user+Session в одной транзакции. Login проверяет Argon2 вне транзакции, затем User FOR UPDATE/проверка актуального hash/новая Session/отзыв прежней cookie/очистка ошибок в короткой транзакции. SessionGuard задаёт actor; каждый будущий project/media/RSVP/XLSX use-case отдельно проверяет ownerId, чужой private resource — нейтральный 404. Эти resource-маршруты ещё не реализованы.

D-29: register 5/IP/15 минут, login 5 неверных/email+IP/15 минут, без постоянного account lock. Login counter атомарен в PostgreSQL: резерв до verify, успех сбрасывает ошибки, infrastructure failure освобождает резерв. Register пока single-process Nest throttler: рестарт сбрасывает counter, несколько инстанций не делят его. Trust proxy выключен; настройка реального proxy/shared storage/TLS smoke обязательна до публичного выпуска. [Пределы и физическая очистка](../operations/sessions.md).

## Следующая E1-04c, не реализация

POST `/password-reset/request` — предложенный одинаковый 202 для существующего/неизвестного email, перехватчик local и принятый канал production. POST `/password-reset/confirm` — предложенный 204 с заменой hash/одноразовым reset-token/отзывом всех Session атомарно; неверный/истёкший/повторный token — нейтральный 400 RESET_TOKEN_INVALID. В БД только hash/expiry/usedAt, ссылка от доверенного origin, не Host клиента. Reset должен брать тот же User lock перед сменой пароля/отзывом сессий. После успеха обычный вход.

Q-11 остаётся для reset TTL/rate, RSVP idempotency/feedback/jobs; password/email/auto-login, Session TTL и количественные register/login limits приняты, повторно не спрашивать. Правовые retention/backup ещё Q-10. UI/reset/load/proxy/production — будущие проверки.

Источники проверены 17.11.2026: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Конкретные 7/30 дней и 5/15 минут — решение владельца, не рекомендации OWASP.
