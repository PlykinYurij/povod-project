# API

[План разработки с чекбоксами](development-plan.md). [Порядок ревью и совместной работы](../../docs/agent-workflow.md).

Место для будущего NestJS API сервиса «Повод». Код, зависимости и команды ещё не созданы. Требования: [карта документов](../../docs/product/README.md).

Агенту: начни с [локального AGENTS](AGENTS.md), [согласованных backend-правил](../../docs/architecture/backend-conventions.md), [контракта](../../docs/architecture/api-contract.md) и назначенной карточки [backlog](../../docs/product/backlog.md). Регистрация/сессии описаны в [identity](../../docs/architecture/authentication.md), проверки — в [QA](../../docs/qa/test-plan.md).

Первый кодовый шаг — [E1-01](../../docs/product/first-task.md): один root GET `/health` без БД. Полный backend-стек добавляется последующими задачами после согласования, не одним генератором всего MVP. Нет команд, которые можно честно назвать уже проверенными командами запуска приложения.
