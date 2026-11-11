# E1-02 · Отчёт CI

База main `aac3aca`, ветка `ci/pull-request-checks`, 11 ноября 2026. E1-01 принят владельцем и присутствует в main. CI-код находится в [workflow](../../.github/workflows/ci.yml), приёмка — [CI-документ](../operations/ci.md).

## Выполненные проверки

| Проверка | Фактический результат |
| --- | --- |
| actionlint v1.7.12 | Exit 0; checksum официального ZIP сверена, бинарник только в игнорируемой .verification, система/PATH не менялись |
| npm ci --no-fund --fetch-retries=0 --fetch-timeout=30000 | Exit 0, lockfile не изменился; 0 известных уязвимостей по ответу registry |
| npm run typecheck / npm run build | Обе exit 0 локально, без новых зависимостей или изменения приложения |
| Положительный hosted run для ef0952b | [43034191302](https://github.com/PlykinYurij/povod-project/actions/runs/43034191302): Windows и Ubuntu success, включая npm ci/typecheck/build и неизменность tracked-файлов |
| Негативный hosted run для 0773529 | [43034265769](https://github.com/PlykinYurij/povod-project/actions/runs/43034265769): обе ОС failure именно на Typecheck, Build пропущен. Fixture `string = 42` также локально даёт TS2322/ненулевой выход |

Негативная ошибка существовала только в отдельной `ci/typecheck-negative-probe`, не сливалась в рабочую ветку или main; удалённая тестовая ветка убрана после проверки неизменности её SHA. Журналы Actions сохраняют свидетельство отказа. Перед финальной публикацией отдельно проверяются diff/Markdown-ссылки/неизменность ТЗ. После документального коммита новый push автоматически повторяет CI; его результат отслеживается ведущим отдельно, не приписывается старому SHA.

## Обязательность для merge

До задачи API main возвращал `protected=false`. Настроена защита main и подтверждена GET-readback HTTP 200: `strict=true`, required `Verify (ubuntu-24.04)` / `Verify (windows-2025)`, оба привязаны к app_id 15368 (GitHub Actions). `required_pull_request_reviews=null`: новых требований к числу ревью нет; `enforce_admins=false` сохраняет обход администратора. Branch protection не выполняется workflow; это отдельная настройка в рамках CI-приёмки. Секреты/значения credentials не выводились и в файлы не сохранялись.

Проверены push-прогоны, не фактическое событие pull_request. Workflow содержит PR-trigger без фильтров, но окончательная PR-проверка появится после открытия PR. Реальный merge запрещённого кандидата не предпринимался. Административный обход не закрыт и не выдаётся за закрытый.

Этап — Review, приёмка владельцем и merge CI ещё впереди. CI не является dev/prod-релизом и не подтверждает продуктовые P/R-сценарии. Серверы, БД, secrets и деплой не создавались; lint/unit/E2E-команды не выдумывались.

Перед итоговым документальным коммитом actionlint повторно завершился с exit 0, git diff --check прошёл; локальные пути ссылок в девяти изменённых Markdown-файлах существуют, исходное ТЗ сохранило SHA-256 `276fbfd4fc094f8b1a4f8d77351370efb24b634568409d54f47f25dff1c578ac`. Негативного fixture в рабочей ветке нет. Код/lockfile приложения не менялись.
