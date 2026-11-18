# Регистрация, аутентификация и права

Backend E1-04/04b принят в main `6ccbf27`; E1-04c подготовлен к ревью (backend/local mail), [QA](../qa/e1-04c-report.md). D-30 ещё требует исправления регистрации [E1-04d](../product/e1-04d.md). Таблица ниже сохраняет текущий register/login/session API; reset описан отдельно. [Решения](../product/decisions.md), [OpenAPI 0.3.0](../../apps/api/openapi.json), [запуск](../operations/password-reset.md).

## Правила и подход

Email trim/lowercase, точки/plus сохраняются, SQL unique. Новые пароли: 8–128 печатных ASCII-символов, минимум A–Z, цифра и спецсимвол; обычный пробел допустим, но не спецсимвол, без trim. Argon2id (@node-rs/argon2 2.2.2, m=19456 KiB/t=2/p=1), случайная соль. Login проверяет полный введённый пароль, не применяет заново правила состава к старым credentials. Роль/ownerId не принимаются из payload. User/passwordHash не возвращается целиком из ORM.

Цель D-30: email/пароль → pending без owner-прав → код из письма → атомарное завершение регистрации и автовход. Уже авторизованному пользователю дополнительное подтверждение не нужно (D-02). В текущем коде register сразу создаёт User+Session: это расхождение, исправляемое E1-04d. Явный 409 занятого подтверждённого email сохраняется D-28. Числовые параметры signup приняты D-32, Q-21 закрыт.

D-29: вход сохраняется после закрытия браузера; idle 7 дней без аутентифицированных HTTP-запросов, absolute 30 дней с выдачи. При равенстве границе доступ закрыт; активность не продлевает absolute. Это сроки входа, не 90 дней публикации/хранение RSVP.

## /api/v1/auth

| Метод | Вход | Результат |
| --- | --- | --- |
| GET `/csrf` | Необязательные context/session cookies | 200 `{csrfToken,expiresAt}`, HttpOnly context-cookie; нет авторизованной Session/DB-строки |
| POST `/register` | JSON email/password, Origin/CSRF | 201 `{user:{id,email}}`, новая session-cookie; 409 EMAIL_UNAVAILABLE, 422 VALIDATION_FAILED |
| POST `/login` | JSON email/password, Origin/CSRF | 200 user и новая cookie, прежняя cookie браузера отозвана; одинаковый 401 INVALID_CREDENTIALS для неизвестного email/неверного пароля |
| GET `/session` | Session-cookie | 200 user текущей Session или 401 AUTH_REQUIRED; токен не возвращается |
| POST `/logout` | Origin/CSRF, необязательная session-cookie | 204, текущая Session отозвана, cookie очищена; повтор/истёкшая/anonymous также 204 при валидном CSRF |

Всё auth no-store. Общие: 400 malformed JSON, 413 body limit, 415 content type, 422 DTO, 403 CSRF_FAILED, 429 RATE_LIMITED/Retry-After, 503 SERVICE_UNAVAILABLE. Формат errors/requestId — [API](api-contract.md). Не логировать пароли/hash/cookie/CSRF/email codes/request bodies.

## Cookie/CSRF/доступ

Session token — 32 случайных байта, в PostgreSQL только SHA-256 и lifecycle. Host-only cookie, Path=/, HttpOnly, SameSite=Lax, Max-Age 30 дней. Production Secure/__Host-prefix/без Domain; local HTTP — отдельные имена без Secure/prefix. Нет JWT/refresh token в localStorage или bearer в JSON. Вход выдаёт новый token, не повышает pre-auth context до Session.

Signed double-submit: случайная HttpOnly context-cookie, HMAC-SHA256 с context/session-cookie/expiry, constant-time проверка. CSRF живёт час; после смены session-cookie/key получить bootstrap. Это техническая настройка, не новый session TTL. Production CSRF_SECRET из secret storage, local key в памяти. Origin/JSON/CORS дополняют SameSite; credentials только для WEB_ORIGIN кабинета, не гостевых поддоменов.

Текущий register создаёт User+Session в одной транзакции; целевой E1-04d переносит создание в подтверждение кода. Login проверяет Argon2 вне транзакции, затем User FOR UPDATE/проверка актуального hash/новая Session/отзыв прежней cookie/очистка ошибок в короткой транзакции. SessionGuard задаёт actor; каждый будущий private use-case отдельно проверяет ownerId, чужой ресурс — нейтральный 404. Ресурсные маршруты ещё не реализованы.

D-29: register 5/IP/15 минут, login 5 неверных/email+IP/15 минут, без постоянного account lock. Login counter атомарен в PostgreSQL: резерв до verify, успех сбрасывает ошибки, infrastructure failure освобождает резерв. Register пока single-process Nest throttler: рестарт сбрасывает counter, несколько инстанций не делят его. Trust proxy выключен; настройка реального proxy/shared storage/TLS smoke обязательна до публичного выпуска. [Пределы и физическая очистка](../operations/sessions.md).

## E1-04c · Реализованный backend восстановления, не web/production

D-31: POST `/password-reset/request` с email — одинаковый 202/message, resend тем же маршрутом. POST `/password-reset/confirm` с email/code/newPassword — 204; неверный/истёкший/повторный код — 400 RESET_CODE_INVALID. Код шесть цифр/10 минут/пять неверных попыток; resend отменяет старый. Три запроса/email/час и десять/IP/15 минут; PG fixed windows, 429/Retry-After. Unknown email учитывается так же. Общие Origin/CSRF/JSON/no-store/DTO guards сохранены. После успеха обычный вход, не автовход.

Код с CSPRNG, в БД только HMAC-SHA256 с purpose/nonce/emailKey и отдельным секретом. Request сохраняет новую заявку под User lock, доставка вне транзакции, активация только текущего UUID после доставки. Confirm проверяет кандидата, хеширует пароль вне lock, затем повторно проверяет под User → challenge lock; смена hash/usedAt/отзыв всех Session атомарны. Неверные попытки commit до ответа об ошибке. Публичная почта/queue/очистка ещё не реализованы. Local inbox запрещён в production; без транспорта 503. [Подробности и сбои](../operations/password-reset.md). Signup/reset purpose раздельные, signup ещё не реализован. Q-11 только RSVP/feedback/jobs, Q-21 закрыт D-32; Q-10 retention/backup.

Источники проверены 17.11.2026: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Конкретные 7/30 дней и 5/15 минут — решение владельца, не рекомендации OWASP.

Для E1-04c повторно проверен 18.11.2026 [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): нейтральные ответы, криптографическая генерация, одноразовость, срок и отзыв сессий. Числа D-31 — выбор владельца. Равенство времени ответа и реальная доставка требуют отдельной проверки перед production.
