# E1-04d · Backend регистрации с подтверждением

18.11.2026; Windows/PowerShell, Node 26.13.0/npm 11.20.0. База main `89175db`, ветка `feat/registration-email-code`. Самопроверка ведущим, не независимое ревью. [Приёмка](../operations/registration-confirmation.md), [карточка](../product/e1-04d.md).

Выполнены typecheck обоих workspace, build web/API (после правок API повторён), генерация OpenAPI 0.4.0 и 8 artifact unit. Append-only миграции применены к отдельным test/dev БД без reset; ранее применённые SQL не переписаны.

`npm run test:database`: **52/52**, четыре suites. Registration — 19 тестов. Существующие session/reset fixtures теперь создают пользователей как тестовые данные и входят через login; это не обход production API. Прежняя проверка отката register+Session перенесена в регистрацию confirm+Session. Production cookie-check использует login; пять start-попыток проверяются отдельно. Не удалены проверки password policy, CORS, CSRF, лимитов, no-store, ошибок и изоляции.

Первые запуски выявили старые ожидания немедленного 201 и лишний expiresAt в confirm test payload; fixtures исправлены, финальный suite успешен. Исходный test runner скрывал failed-output, диагностика включалась штатным обезличенным POVOD_DB_DIAGNOSTICS, затем выключена.

Проверенные данные/действия → результат:

- Новый email/password → 202, нет User/новой Session; pending хранит hash. Валидный код из реального test inbox → 201, безопасный DTO, emailVerifiedAt, GET session 200.
- Два одновременных start нормализованного email → одна актуальная pending; два confirm → 201/400 и один User. Новый пароль/ID заменяют старую pending; старый код не авторизует новые credentials.
- Пять конкурентных неверных попыток → все учтены, верный код затем отклонён. Ровно 10 минут → отказ; ровно 24 часа → отказ resend, вызов реального sweep удаляет строку.
- Resend отменяет прежний код и не продлевает deleteAt; задержанное письмо не активирует старую заявку. Сбой delivery оставляет код неактивным/503; Session failure откатывает аккаунт и pending, retry успешен.
- Start/resend делят email-limit, IP-limit охватывает разные адреса, forged XFF не обходит его. Guard invalid forms/Retry-After и production five-limit сохранены.
- Confirm/resend без CSRF → 403; malformed/non-string code и server fields → 422. Подтверждённый email → 409, replay → 400. Живой Swagger описывает DTO/ошибки; hash/password не возвращаются.
- Существующие suites reset/session/DB успешны. Проверены прежние concurrent login/reset и session security; новый UI/права ещё не существующих проектов за проверенные не выдаются.

Реальный dev helper запущен на свободном loopback-порту: start 202 → отсутствие User и session 401 → письмо → confirm 201 → session 200 → replay 400. После smoke удалены только свой синтетический User/pending/limiter fixtures и своё письмо; остановлено только собственное дерево процессов. Значения кода/паролей/cookie не печатались.

Не выполнены: UI/Orval/E2E, SMTP/production TLS/proxy/load, реальная 24-часовая выдержка (вместо неё управляемый clock и SQL cleanup), public retention/backup/метрики и legacy-правило Q-22. Приёмка владельцем и main не отмечены. CI/isolated artifact будут указаны по факту после публикации кода.

## Итог опубликованного кода

Код 51dc34b06e909c955c805fa9e5782132f91c3f63: [CI 44296283422](https://github.com/PlykinYurij/povod-project/actions/runs/44296283422) — четыре jobs success (Windows, Linux, Database integration, Linux build kit). Windows preview kit также успешно собран через npm run artifact:create из git archive: clean npm ci, типы/сборки, native imports и runtime smoke вне репозитория; web/health/staticAsset — 200. Manifest SHA-256: 894f678bb57b5edfc3762c41b4d195b589d0917d6ed5794b9e4c1ec30a76389a. Локальный ignored-каталог: artifacts/51dc34b06e909c955c805fa9e5782132f91c3f63-win32-x64-local-bde4346a-0633-4756-a4af-4e9b0c09c714-1. Проверка integrity командой artifact:verify с этим SHA/digest и --allow-preview выполнена отдельно.

Просмотрены diff/новые файлы, diff --check; проверено 211 локальных путей Markdown (без якорей), неизменность ТЗ и отсутствие локальных credentials в изменениях. Lockfile/зависимости не менялись. Известные пять high dev-entries E1-02b остаются; audit не объявляется зелёным. Последующий коммит меняет только документы, kit относится к коду 51dc34b06e909c955c805fa9e5782132f91c3f63. Owner acceptance/main не отмечены.
