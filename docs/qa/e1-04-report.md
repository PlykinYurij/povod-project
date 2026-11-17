# E1-04 · Проверки backend регистрации

Последнее уточнение владельца — пароль только с буквами A–Z/a–z. Сервер и OpenAPI теперь требуют печатный ASCII (U+0020–U+007E), uppercase A–Z, цифру 0–9 и спецсимвол. Добавлены отрицательные HTTP-cases: кириллица/похожая А, café, emoji, арабская цифра, tab и final newline. После изменения успешны strict typecheck API/тестов, build API, OpenAPI export и все 13 DB/HTTP tests. Старые CI/kit SHA ниже относятся к предыдущему варианту; свежий коммит проверяется отдельно. Полный локальный kit для изменения одного DTO не повторялся: зависимости/native runtime не менялись.

17.11.2026, база main 311f808, ветка feat/registration. Самопроверка ведущего; независимое QA не выполнялось. Node 26.13.0/npm 11.20.0, Windows/PowerShell, PostgreSQL 17.12 в Docker. Backend-часть Review, frontend/session/публичный выпуск не готовы.

Фактически выполнено:

- Миграция users/unique email применена отдельно на проверенные test/dev БД. Старые миграции не изменялись.
- `npm run test:database`: 13 тестов (4 E1-06 + 9 HTTP E1-04). Реальные Nest HTTP/PostgreSQL/Argon2, без моков БД/hash. Границы 7/8/128/132, состав/Unicode/пробелы/null, unknown fields, email normalization, safe DTO/no-store/no cookie, salt/verify, конкурентный дубликат, JSON/body size/Origin/Content-Type/CORS, throttle/Retry-After/forged IP, production fail-closed, отсутствие DB config и live OpenAPI.
- Гонка сначала выявила 503 вместо 409 из-за формы Prisma adapter metadata; исправлено проверкой существующего normalized email при P2002. Повтор теста успешен, одна строка сохранена.
- Strict typecheck API и тестов, обе сборки, экспорт OpenAPI и 8 artifact unit-тестов прошли. Проверки типов выявили unknown у response.json и nullable app; исправлены типизированными test-boundary readers/импортами и повторно проверены.
- Runtime audit после установки — 0 известных уязвимостей. Swagger 11.4.8 совместим с Nest 11; major Nest не менялся. Native Argon2 входит через optional platform package, без разрешения глобальных install scripts; @scarf postinstall также не разрешён.

`npm ci` успешен (351 packages, audit 0), после него полный typecheck/build, OpenAPI export и suites успешны. Реальный helper `dev:api:database` проверен на отдельном порту 3101: health, Swagger UI HTML и live JSON 200, аккаунты в dev при этом не создавались. Собственное дерево процессов остановлено. Dev-проверка выявила несовместимые .js imports generated client с ts-node; исправлено настройкой generator importFileExtension="", а не ручной правкой generated. Повтор dev и compiled tests успешен.

Hosted CI/новый isolated kit отмечаются ниже после фактического выполнения. Лимит 5/15 — пробный локальный, не принятое владельцем продуктовое правило; тесты используют собственные 100 и 1, не отключают production guard. Не проверены готовая web-форма/auto-login/sessions/reset, browser UI WebStorm, нагрузка, multi-instance proxy, production/deploy. Unit-тесты артефактов не выдаются за проверки бизнес-правил.

Финальный локальный проход: просмотрены staged diff и новые файлы; `git diff --cached --check`, node syntax и actionlint успешны. Проверены 160 локальных путей ссылок в 43 staged-файлах (без якорей), значения трёх реальных env-паролей не найдены в staged-содержимом. SHA-256 исходного ТЗ сохранён: `276fbfd4fc094f8b1a4f8d77351370efb24b634568409d54f47f25dff1c578ac`. После последнего выделения local URL helper повторно успешны tests/dev HTTP; shared helper не принимает внешние адреса.

Код `46db0b15a83faa224ccd15abe398c22691b5126e`:

- [Hosted CI 44050592409](https://github.com/PlykinYurij/povod-project/actions/runs/44050592409) — success: обе Verify, Database integration (чистые migrations/seed + 13 tests), Build kit Linux. Verify регенерирует tracked OpenAPI и проверяет отсутствие diff.
- Полный Windows `npm run artifact:create` — success: clean committed snapshot, типы/сборки, production install с --ignore-scripts, native Argon2 hash/verify вне checkout, импорт Prisma/adapter, web/health/CSS 200. Manifest digest `27b248bab92475b480c11897c98dd17fc310f1bbc31a5ce0ceac2436b1b25594`, preview. Kit содержит OpenAPI и SQL того же SHA. Это не deploy и не публичный пилот.
- Первая отметка API-плана выставлена только по завершённым проверкам. Принятие владельцем/main не отмечены. Последующий коммит документации проходит свой CI отдельно.
