# Общая заявка · Реализованные границы V2-02

Ветка feat/public-service-requests, не main. [Контракт](../product/v2-02-public-service-request.md), [Prisma](../../apps/api/prisma/schema.prisma), [QA](../qa/v2-02-service-requests-report.md).

```mermaid
sequenceDiagram
  participant C as Посетитель без аккаунта
  participant A as NestJS public request API
  participant D as PostgreSQL
  C->>A: JSON контактов + UUID key + Origin
  A->>A: Origin/JSON, DTO, query/key validation
  A->>D: BEGIN; lock key hash; lookup receipt
  alt Повтор прежнего тела
    D-->>A: Исходный requestId/createdAt
    A-->>C: 200 RECEIVED без контактов/URL
  else Новый key
    A->>D: IP → phone rate upsert (HMAC keys)
    alt Лимит превышен
      A->>D: COMMIT counters, без заявки
      A-->>C: 429 + Retry-After
    else Разрешено
      A->>D: INSERT assistance + consent metadata; COMMIT
      A-->>C: 201 RECEIVED
    end
  end
```

ServiceRequestsController отвечает за HTTP, ServiceRequestsService — key/транзакцию/создание, RequestRateService — счётчики/сроки rate. JsonOriginGuard общий с identity/projects (прежнее имя RegistrationOriginGuard оставлено alias), readIdempotencyKey/rejectUnknownQuery вынесены из projects в общий HTTP модуль при втором потребителе. Частные Session/CSRF проверки не перенесены в public lead и не удалены из private API.

service_requests хранит id, kind, nullable project/customer FK, contactName/phone/channel/value, status/requestVersion/submittedRevision, hashes key/body, consentAt/version и createdAt/updatedAt. Точный SQL/индексы — миграция 20261121020000_service_requests. При anonymous create kind=ASSISTANCE, project/customer/submittedRevision null, status=NEW. Клиент не назначает эти поля. Форма контактов строго типизирована; content JSONB проекта сюда не копируется.

Индекс key unique + advisory transaction lock на namespaced SHA-256 key защищает повтор между экземплярами; collision advisory hash может лишь сериализовать лишние запросы, unique полный hash сохраняет инвариант. PRIVATE publication route получит отдельный actor/key namespace. Rate блокировки идут IP → phone. Denial возвращается из transaction как результат, поэтому счётчики сохраняются, а HTTP 429 формируется после commit. Техническое исключение откатывает всё. Повтор известного key/body проверяется до rate и возвращает исходную квитанцию даже после operator-изменений, не раскрывая текущий приватный workflow.

Raw IP не хранится, rate phone/IP HMAC используют отдельный secret. Global public limit не использует cookie/Authorization/XFF как identity. Partial unique(project_id) для NEW/IN_PROGRESS подготовлен для следующей V2-01; один открытый заказ не замораживает проект D-43. FK проекта RESTRICT требует явной политики очистки/удаления, customer FK SET NULL допускает раздельный жизненный цикл; эти FK не являются готовой функцией удаления аккаунта/передачи проекта.

Состояние подтверждения RECEIVED не является state публикации/оплаты. Public GET и угадываемая ссылка чтения не создаются. Контакты остаются приватными до реализации RBAC operator query; будущие UI должны отображать contactValue как текст, без автоматического href/HTML/fetch. Consent и retention контактов отдельно от срока проекта/публикации; Q-10/публичный запуск остаются условиями, не автоматическим результатом API.
