# E1-02 · Проверки изменений

[Workflow](../../.github/workflows/ci.yml) запускается на push, pull_request и вручную (после появления workflow в основной ветке). Ветка задачи основана на принятом каркасе main `aac3aca`. Требование — NFR-14, зависимость — E1-01.

На `ubuntu-24.04` и `windows-2025` выполняются одинаковые шаги: checkout → Node из .node-version → npm 11.20.0 → npm ci → npm run typecheck → npm test → npm run build → проверка отсутствия изменений tracked-файлов. Vitest-проверки появились в E1-07. Используется один корневой lockfile. На одноразовом CI runner npm устанавливается явно; на компьютере разработчика инструменты не переустанавливаются.

Стабильные required checks: `Verify (ubuntu-24.04)`, `Verify (windows-2025)` и добавленный E1-07 `Build kit (linux-x64)`. Все привязаны к GitHub Actions app 15368, strict=true; administrative bypass сохранён. Ошибка команды завершает job с failure, последующие шаги не скрывают её. Результаты двух ОС независимы (`fail-fast: false`), лимит каждого job — 15 минут. Новое событие той же ветки/типа отменяет устаревший run. Push и PR проверяются отдельно: PR проверяет merge-кандидат, push — commit ветки; результат push не подменяет PR-проверку.

Нет path-фильтров, continue-on-error, pull_request_target, production secrets, deploy/БД/медиа/services. GITHUB_TOKEN имеет только contents:read, checkout не сохраняет credentials. Кешируется npm download cache, не node_modules/.next/dist. Verify-builds — проверочные; [E1-07](artifacts.md) добавляет после них отдельный `Build kit (linux-x64)` с изолированным runtime smoke. На push он публикует preview/candidate по ref, PR только проверяет сборку.

Корневой npm test реально проверяет целостность build-комплекта; это не тесты ещё не созданных бизнес-функций. Lint/E2E scripts пока нет, они добавляются по реальному инструментарию. Аудит безопасности не заменяет сборку; отдельная политика регулярного аудита будет согласована позднее.

## Приёмка

1. Локально: `npm ci`, `npm run typecheck`, `npm run build`; валидировать workflow официальным actionlint. В этой задаче actionlint скачивается только в игнорируемую .verification, checksum релиза сверяется; глобальной установки/PATH нет.
2. На GitHub: успешный run ветки на обеих ОС.
3. Контролируемая ошибка TypeScript в отдельной тестовой ветке должна давать failure на том же шаге Typecheck; рабочая ветка и main не содержат ошибки. Ссылки/SHA запусков и фактические статусы заносятся в [отчёт](../qa/e1-02-report.md).
4. PR в main показывает эти же проверки: реальный pull_request-trigger проверен в [draft PR #8](https://github.com/PlykinYurij/povod-project/pull/8), обе ОС success. Через существующий административный доступ настроена и повторно прочитана защита main: оба check обязательны, привязаны к GitHub Actions app 15368, `strict=true` требует актуальную базу. Это отдельная настройка GitHub, не действие workflow. `enforce_admins=false`: у администратора сохранён обход; число обязательных ревью не навязывалось. Абсолютный запрет обхода администратором не заявляется.

## Источники и обновление

11 ноября 2026 сверены официальные [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [триггеры](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Actions закреплены по полному SHA текущих v6, проверенному через git ls-remote; тег в комментарии только для чтения. Обновление SHA и инструментов — отдельное проверяемое изменение, не автопереход на latest.
