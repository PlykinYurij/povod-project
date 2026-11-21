# Архитектура

- **MVP v2 для ревью:** [система, роли и admin-публикация](assisted-publication.md), [модель данных и типизация/SQL-vs-JSONB](assisted-data-model.md), [переход без нового репозитория](mvp-transition.md).
- **Текущее реализованное состояние до v2:** [компоненты и все таблицы/поля/связи](current-system.md). Это snapshot main 3626e47, не уже выполненная новая архитектура.

- [Контракт реализованного технического каркаса E1-01](skeleton-contract.md); [проверки](../qa/e1-01-report.md). Остальные документы описывают будущую продуктовую вертикаль, а не уже работающий API.

- [Backend: стек, модули, валидация и ограничения](backend-conventions.md) — согласовано D-27; [инструкции API-агенту](../../apps/api/AGENTS.md).

Ранние предложения первой вертикали ниже сохраняются как история v1; self-service publish заменён D-38/39. Приоритет: [решения владельца](../product/decisions.md), затем [MVP v2](../product/mvp-v2.md). Identity/draft API уже реализованы, новые requests/admin/publication ещё нет.

- [Компоненты, сущности, публикация, права и время](first-scenario.md).
- [Начальный API: поля, ошибки, повторы](api-contract.md).
- [Решения, альтернативы и вопросы](decisions.md).
- [Сверка экранов / API / данных / FR](../design/traceability.md).

- [Регистрация, вход, сессии, восстановление и права](authentication.md) — отдельное проектное уточнение identity.

- [Правила web / FSD / API codegen / темы](web-conventions.md).
- [Публикация, единый web и пользовательские поддомены](publication-addresses.md).

D-40: JSONB выбран. [Добавление, удаление и перенос полей шаблона](template-schema-evolution.md): версии схем отдельно от revision проекта; массовое изменение данных — явная проверяемая миграция.

E2-02d (ветка, ещё не main): users.role USER/ADMIN и server AdminGuard реализованы. [Контракт и границы](../product/e2-02d-admin-access.md). Snapshot current-system.md выше сохраняет фактическую историю main 3626e47; в новой ветке добавлены role и десятая миграция, без остальных проектируемых v2 сущностей.

- [Реализованный каталог E2-01d и схема новых таблиц](catalog-data.md): фактическая схема ветки, кодовый registry, FK, locks и ненастроенный прайс; не смешивать с историческим snapshot main.

- [Реализованная общая заявка V2-02](service-requests.md): транзакция, idempotency/rate, data/identity границы; контакты отдельно от Project JSONB и 90 дней.

- [Owner-заявка V2-01](publication-requests.md): общий owner access, сохранение во время ожидания, price snapshot/текущий прайс и границы private API.
