# GitHub

[ci.yml](workflows/ci.yml) проверяет npm ci, типы и сборки web/API на Windows и Linux. [Порядок и границы](../docs/operations/ci.md), [фактические результаты](../docs/qa/e1-02-report.md). Деплоя, секретов production и БД здесь нет. Само наличие workflow не означает успешного запуска или настройки обязательных проверок merge.

E1-07 добавляет Vitest для целостности и отдельный `Build kit (linux-x64)` после Verify: [комплект по SHA](../docs/operations/artifacts.md). PR собирает/проверяет preview, push загружает immutable artifact с manifest/digests. Только main даёт candidate; это ещё не выпуск на dev/production.
