# E1-07 · Проверки комплекта

Ветка `feat/sha-build-artifact`, база main `e30750c`, 11 ноября 2026. Выполняется следующий независимый готовый этап E1-07. E1-05 пока не готов: Docker/PostgreSQL не найдены, WSL2 доступен, дистрибутивы отсутствуют; установка системных компонентов не выполнялась.

На начальном этапе локально прошли 8 Vitest-тестов проверки целостности/источника/preview/состава/выходящих symlink/env, npm run typecheck и обе production-сборки с Next standalone. actionlint и node --check scripts/artifact/*.mjs без ошибок. Vitest 4.1.12 установлен как реальный потребитель тестов, npm audit при установке — 0 известных уязвимостей.

## Полный цикл и опубликованный preview

Код builder зафиксирован в `1a14e57c1b5ce8bf8794da5d66d99aa4e9bab116`, затем из чистого checkout запущен `npm run artifact:create` на Windows. Создан отдельный win32/x64 preview. Из распакованных tar вне репозитория без установки/сборки web `/`, CSS и API `/health` дали 200. Smoke-процессы завершены самим runner. Manifest hash локального комплекта — `51b76d0bf8ce81cb518c7c8561185c5c4bc4bad82de1dbdec44a36bab3aab345`. CLI verifier с --allow-preview завершился 0, без opt-in отклонил preview с exit 1.

[Hosted run 43041933802](https://github.com/PlykinYurij/povod-project/actions/runs/43041933802) для того же SHA: обе Verify jobs Windows/Linux success, `Build kit (linux-x64)` success. Builder повторил чистую установку/типы/сборку и проверил готовые Linux runtimes, затем загрузил preview:

- Artifact ID `13866320790`, [скачать в GitHub](https://github.com/PlykinYurij/povod-project/actions/runs/43041933802/artifacts/13866320790).
- Внешний digest: `sha256:9b5ced5ddf5d23011ff5a3db7e8bb9bd6cf5af92e9d714735c84ae12a9f24c9c`.
- Доверенный manifest hash из CI job logs: `e0a1550df409fcd5714ff9f9c38ede82a270f5a15402bbf89457b09504d13129`.

Artifact скачан через API существующим GitHub-доступом без вывода/сохранения credentials; внешний ZIP digest проверен до распаковки. Verifier распакованного комплекта прошёл на Windows (проверка целостности Linux payload, не его запуск на Windows). Отдельная копия с повреждённым web.tar.gz отклонена CLI с `web digest mismatch`, exit 1. Исходный опубликованный комплект не менялся.

После сборки обнаружено, что стандартный Vitest search повторно находил копию тестов внутри .artifact-work. Добавлен vitest.config.mts с явным include только исходного suite; повторный npm test — ровно 8 tests / 1 file, exit 0. Новые scripts отформатированы стандартным Prettier 3.10.0 через временный npm exec, без глобальной установки/изменения зависимостей formatter. Последние изменения и документы повторно проверяются CI для итогового SHA; свидетельство выше не приписывается другому коммиту.

Отдельно проверен запуск artifact:create при незакоммиченных изменениях: отказ с exit 1 до сборки (`Commit changes first`), данные не перезаписаны. Неудачная попытка не выдаётся за новый комплект.

Перед итоговой проверкой standalone ограничен флагом builder POVOD_BUILD_KIT=1: исходный Next сообщает, что обычный next start не предназначен для output:standalone. Флаг сохраняет существующие локальные build/start-команды и отдельно проверяется новой сборкой комплекта в CI.

## Границы проверки

Этап Review, не принят владельцем и не слит в main. Проверено preview-пакетирование: ветка main-candidate будет выполняться при принятом push main, её ещё не выдаём за выполненную. Подпись/attestation, постоянное хранилище релизов, реальный dev/prod, rollback на сервере, БД и миграции не проверялись/не создавались. Срок хранения GitHub artifacts не связан с 90 днями приглашения. Тесты целостности — самопроверка исполнителя, не независимое QA-ревью.

Инструкция — [artifacts](../operations/artifacts.md), критерии — [E1-07](../product/e1-07.md).
