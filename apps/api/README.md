# API

NestJS API сервиса «Повод»: реализован только технический каркас E1-01, root GET `/health` → 200 `{"status":"ok"}`. Без БД и бизнес-маршрутов. Команды и ограничения — [корневой README](../../README.md), проверки — [отчёт](../../docs/qa/e1-01-report.md).

Агенту: начни с [локального AGENTS](AGENTS.md), [предложения backend-правил](../../docs/architecture/backend-conventions.md), [контракта](../../docs/architecture/api-contract.md) и назначенной карточки [backlog](../../docs/product/backlog.md). Регистрация/сессии описаны в [identity](../../docs/architecture/authentication.md), проверки — в [QA](../../docs/qa/test-plan.md).

Из apps/api: `npm run dev` (Node watch + ts-node), `npm run typecheck`, `npm run build` (tsc), `npm run start` после build. Установка `npm ci` из корня. Локальный адрес 127.0.0.1:3001, PORT можно переопределить целым 1..65535. Полный backend-стек добавляется последующими задачами, не одним генератором MVP; Nest CLI каркасу не нужен.
