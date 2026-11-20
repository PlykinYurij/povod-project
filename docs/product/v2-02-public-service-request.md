# V2-02 · Общая заявка без регистрации

21.11.2026, реализовано/проверено, Review, feat/public-service-requests. База main 3626e47 + проверенные E2-02d/E2-01d (195f26c), не приняты владельцем/main. D-38/41/42, R2-04/10, FR-24, NFR-07–12. Это ingestion API и контракт, web-форма/admin очередь — отдельные задачи.

## Рабочий контракт A-07, не новые ответы владельца

POST /api/v1/service-requests, JSON, обязательный UUID Idempotency-Key и точный WEB_ORIGIN. Без Session/аккаунта. Поля: contactName (trim, 1–80), phone (нормализуется к + и 7–15 цифрам; российские 8/7 с 11 цифрами → +7), contactChannel (TELEGRAM/MAX/VK), contactValue (trim, 1–200, ник/ссылка как безопасный текст), privacyConsent строго true. Управляющие символы/непарные surrogates/markup в контактном значении запрещены; неизвестные server поля, projectId/role/customerUserId/status — 422.

Не подтверждаем существование телефона/профиля и не проверяем чужой мессенджер API. ContactValue хранится/отображается как текст, не исполняемый HTML/автоматический href и не цель server fetch. Материалы/документы клиент передаёт оператору при общении (A-05), загрузки не добавляются.

201 при новой заявке, 200 при повторе того же key/нормализованного тела: только requestId/status RECEIVED/createdAt. RECEIVED — исходное подтверждение приёма, не текущий статус обработки (NEW в БД при создании); повтор не обещает, что оператор ещё не начал работу. Не возвращать контакты или публичный URL; этот ID не даёт public GET/private доступа. Иное тело с прежним key — 409 IDEMPOTENCY_KEY_REUSED, без изменения исходной заявки. Успех — приём заявки, не оплата/публикация.

Сервис не использует cookie/Authorization для привязки customer: общая заявка остаётся анонимной даже при наличии чужой/устаревшей session. Transport отправляет её credentials omit и не подмешивает CSRF/session. Origin+JSON обязательны; дополнительный double-submit CSRF здесь не используется, так как нет cookie-полномочий. Это не замена anti-bot: до публичного запуска нужны edge protection/проверка реальной схемы proxy.

Два PG ограничения на новые заявки: 10/IP/15 минут и 3/нормализованный телефон/час, 429 RATE_LIMITED + Retry-After. Ключи HMAC, без raw IP/phone в rate-таблице; SERVICE_REQUEST_RATE_SECRET общий для экземпляров/обязателен production, local fallback эфемерен. Повтор уже принятого key/body не расходует квоту. Состояние rate и insert согласованы одной транзакцией; запрет фиксирует rate counters, технический rollback не оставляет заявку.

privacyConsent/consentAt/consentVersion сохраняют технический факт подтверждения. Юридический текст/основания/срок контактных данных Q-10 и политика очистки — условия публичного запуска, не считаются проверенными одним checkbox. Контактные данные не смешиваются со сроком публикации 90 дней; очистка запросов отдельная от media/RSVP.

## Проверки

Анонимный submit без создания User/Project, три канала/нормализация/422, origin/media/body errors, idempotency/replay/different payload и гонка двух серверов, persistent IP/phone limits/Retry-After/expiry, никакой подмены Session/привязки/ролей, no-store и отсутствие public GET/PII/ложного URL. Реальная povod_test, уникальные синтетические контакты, cleanup только fixtures. Typecheck/build, OpenAPI → Orval, transport boundary/root tests и diff. Результаты будут записаны после выполнения.

## Фактическая готовность

- [x] Результат и проверки: [QA](../qa/v2-02-service-requests-report.md), [архитектура](../architecture/service-requests.md), [local](../operations/service-requests.md).
- [ ] Ревью владельца.
- [ ] Интеграция в main.

Коммерческий/юридический публичный запуск не закрыт технической приёмкой API. Web-форма V2-05 и очередь V2-03 не выданы за готовые.
