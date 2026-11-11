# E1-07 · Проверки комплекта

Ветка `feat/sha-build-artifact`, база main `e30750c`, 11 ноября 2026. Выполняется следующий независимый готовый этап E1-07. E1-05 пока не готов: Docker/PostgreSQL не найдены, WSL2 доступен, дистрибутивы отсутствуют; установка системных компонентов не выполнялась.

На начальном этапе локально прошли 8 Vitest-тестов проверки целостности/источника/preview/состава/выходящих symlink/env, npm run typecheck и обе production-сборки с Next standalone. actionlint и node --check scripts/artifact/*.mjs без ошибок. Vitest 4.1.12 установлен как реальный потребитель тестов, npm audit при установке — 0 известных уязвимостей.

Полная сборка из committed snapshot, runtime smoke и hosted-загрузки проверяются после первого коммита builder; до получения результатов не считаются успешными. Инструкция — [artifacts](../operations/artifacts.md), критерии — [E1-07](../product/e1-07.md).
