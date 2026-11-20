# Эксплуатация

Текущие операции и планы:

- [Windows, локальный каркас и разделение сред](local-development.md).
- [Локальные PostgreSQL dev/test: запуск, изоляция, сохранность](local-postgres.md).
- [Prisma: генерация, миграции, synthetic seed и тестовая БД в CI](database-migrations.md).
- [Приватные черновики: девятая миграция, запуск и приёмка API](private-drafts.md).
- [Backend регистрации: локальный запуск, Swagger и приёмка](registration.md).
- [Cookie-сессии: автовход, login/logout, CSRF и ручная проверка](sessions.md).
- [CI Windows/Linux и обязательные проверки main](ci.md), [фактический отчёт](../qa/e1-02-report.md).
- [Комплект web/API по SHA: упаковка, digests и runtime smoke](artifacts.md).
- [PR → комплект SHA → dev → ручной production, миграции и откат](release-plan.md).

Каркас и CI реализованы; dev/prod-среды и выпускные процедуры ещё не созданы. Реальные команды локального запуска — в корневом README; работа CI подтверждается конкретными hosted-прогонами, не наличием YAML.

Backend восстановления: [E1-04c — локальная почта, запуск и ручная приёмка](password-reset.md). Production-транспорт не реализован.

[Локальная приёмка web регистрации и восстановления](web-identity.md): формы, файловая почта, подтверждение и новый вход после reset.
