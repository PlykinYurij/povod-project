# Регистрация с email-кодом · E1-04d

Backend присутствует в main; web на Review: [регистрация и reset](web-identity.md). D-30/32, FR-02/03 и NFR-07/09. [Карточка](../product/e1-04d.md), [QA](../qa/e1-04d-report.md). Почта — тот же локальный файловый перехватчик, что у reset; SMTP не реализован, production-регистрация закрыта 503 до появления транспорта.

## Локальный запуск

При работающем Docker Desktop из корня PowerShell, Node 26.13.0/npm 11.20.0:

```powershell
npm run db:migrate:dev
npm run dev:api:database
```

API — http://127.0.0.1:3001, просмотр Swagger — http://127.0.0.1:3001/api/docs. Web отдельно: `npm run dev:web`, регистрация доступна на `/register`; [приёмка](web-identity.md). Остановка — Ctrl+C. Для тестов после build: `npm run db:migrate:test`, `npm run test:database`; только изолированная test-БД, без reset.

## Приёмка HTTP-сценария

Использовать свой синтетический email. Все POST — JSON, Origin `http://127.0.0.1:3000`, CSRF из GET `/api/v1/auth/csrf`, один cookie context. PowerShell-клиент/сессии: [инструкция](sessions.md). Код, cookie, пароли и письмо не выводить в диагностике и не коммитить.

1. POST `/api/v1/auth/register` с `{displayName,email,password}` → **202 `{registrationId,expiresAt}`**. Это заявка, не User. GET session без прежней owner-cookie → 401. Если браузер уже был авторизован, старт новой заявки не повышает её права и не выдаёт новую Session.
2. Найти своё письмо в `.local-mail/`: `purpose=registration`, `to` — ваш тестовый email. Имя файла — UUID выдачи, не email и не registrationId. Код — строка шести цифр, включая ведущие нули. Папка игнорируется Git, никому её не передавать.
3. POST `/api/v1/auth/register/confirm` с `{registrationId,code}` → **201 `{user:{id,email,displayName}}`** и HttpOnly session-cookie. GET session → 200. После смены cookie заново получить CSRF перед мутациями.
4. Повтор confirm → 400 REGISTRATION_CODE_INVALID, без второго пользователя/сессии. Потеря успешного ответа: обычный вход с выбранным паролем; не обещать повторный 201.
5. Resend — POST `/register/resend` с `{registrationId}` → 202 с прежним ID и новым expiresAt. Старый код недействителен. Не передавать expiresAt обратно: неизвестные поля отклоняются 422.

Регистрация на подтверждённый email — 409 EMAIL_UNAVAILABLE, без изменения пароля/сессий этого аккаунта. Новый start на email незавершённой заявки заменяет её ID, имя, пароль/hash и код. Старые ID/коды не подтверждают новые credentials. Email trim/lowercase, точки/plus сохраняются; новый пароль — D-28 с уточнением D-34: без пробелов и trim. Имя для обращения: 1–80 символов, trim, без управляющих символов; не уникальный login. Старые User/pending могут иметь null имени.

Код действует 10 минут, пять неверных попыток исчерпывают его. Start/resend делят лимиты три письма/email/час и десять запросов/IP/15 минут, отдельно start ограничен пятью попытками/IP/15 минут (включая невалидные формы). Счётчики писем — PostgreSQL, отдельный namespace от reset; start guard пока single-process по прежнему D-29. 429/Retry-After, unknown/expired request/code — нейтральная 400. Common: Origin/CSRF 403, DTO 422, content type 415, malformed JSON 400, body limit 413, зависимости 503. Host/IP из forwarded headers не доверены.

## Хранение, сбои и границы

Pending не имеет ownerId, квот и Session. В БД hash пароля Argon2id и HMAC кода с purpose/email/nonce. Отдельный `REGISTRATION_CODE_SECRET` — минимум 32 случайных байта в hex, вне Git; без него local key эфемерен и рестарт отменяет ранее выданные коды. Не переиспользовать secret reset. Сам код доступен только в локальном письме. Production-почта/секреты/изоляция и доставляемость отдельно.

Доставка вне транзакции. До успешной записи письма и активации текущего ID/nonce код не работает. Ошибка доставки → 503, pending может остаться без deliveredAt; повторить start. Старое запоздалое письмо не активирует заменённую заявку. Падение после записи письма до активации требует нового start/resend. Автоматических retries/очереди доставки пока нет.

Confirm сериализуется по email в PostgreSQL advisory transaction lock, повторно проверяет pending, срок и попытки. User+Session и удаление pending — одна транзакция. Ошибка Session откатывает всё, включая потребление кода. Invalid attempts сохраняются до ответа об ошибке.

Resend не продлевает 24-часовой срок самой заявки. Срок кода ограничен также deleteAt. После deleteAt API закрыт без ожидания очистки. Физическая очистка — sweep раз в 60 секунд, до 500 просроченных строк за проход, SKIP LOCKED; при остановке API/сбое БД/большом backlog удаление задержится до следующих успешных проходов. Это базовый локальный retention, не обещание удаления ровно до миллисекунды или production SLA; мониторинг/retention backup — до выпуска. Локальные письма sweep не удаляет, очищать отдельно как синтетические данные.

Новые подтверждённые аккаунты получают emailVerifiedAt. Старые аккаунты не объявляются подтверждёнными задним числом: nullable marker, существующий login сохранён. Политика этих legacy-аккаунтов — Q-22 до публичного выпуска, не разрешение считать их email проверенным. Ничьи старые аккаунты/сессии миграцией не удаляются.

Web/Orval и review D-34 проверены отдельно: [QA](../qa/identity-review-report.md). Production SMTP/надёжная доставка, наблюдаемость и legacy-политика остаются отдельными задачами. Реальная почта этим не проверена.
