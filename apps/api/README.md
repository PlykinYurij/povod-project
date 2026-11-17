# API

E1-04: [регистрация/Swagger/локальный DB-запуск](../../docs/operations/registration.md), [экспортированный контракт](openapi.json), [QA](../../docs/qa/e1-04-report.md). Приёмка backend отдельно от ещё не реализованных web/session. Root `npm run dev:api:database` загружает только локальный dev URL из ignored env; обычный `dev:api` его не загружает. В dev Swagger `/api/docs`, JSON `/api/openapi.json`.

[План разработки с чекбоксами](development-plan.md). [Порядок ревью и совместной работы](../../docs/agent-workflow.md).

NestJS API сервиса «Повод»: root GET `/health` → 200 `{"status":"ok"}`. Добавлены Prisma, техническая миграция и проверки БД по [E1-06](../../docs/operations/database-migrations.md). Бизнес-маршрутов пока нет; Nest не подключается к БД при старте. Команды каркаса — [корневой README](../../README.md).

Требования: [карта документов](../../docs/product/README.md).

Агенту: начни с [локального AGENTS](AGENTS.md), [согласованных backend-правил](../../docs/architecture/backend-conventions.md), [контракта](../../docs/architecture/api-contract.md) и назначенной карточки [backlog](../../docs/product/backlog.md). Регистрация/сессии описаны в [identity](../../docs/architecture/authentication.md), проверки — в [QA](../../docs/qa/test-plan.md).

Из apps/api: `npm run dev` (Node watch + ts-node), `npm run typecheck`, `npm run build` (tsc), `npm run start` после build. Установка `npm ci` из корня. Локальный адрес 127.0.0.1:3001, PORT можно переопределить целым 1..65535. Полный backend-стек добавляется последующими задачами, не одним генератором MVP; Nest CLI каркасу не нужен.
