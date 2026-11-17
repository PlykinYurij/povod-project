# E1-04b · Проверки backend сессий

17.11.2026, база main 9c0cc4c, ветка feat/identity-sessions. Самопроверка ведущего, независимого QA не было. Node 26.13.0/npm 11.20.0, Windows/PowerShell, PostgreSQL 17.12. Backend Review, UI/реальный HTTPS/release не готовы.

Локально фактически прошли 25 DB/HTTP tests (4 database, 9 registration, 12 sessions) и 8 artifact unit tests. Strict typecheck включает тесты, обе сборки и OpenAPI export успешны. Реальные PostgreSQL/Nest HTTP/Argon2/cookie, не моки БД/хэшей.

| Проверка | Исходные данные → действие | Результат |
| --- | --- | --- |
| Автовход/hash storage | Синтетический register → GET session, проверка DB/cookie | 201/200, только user, raw token только cookie, DB хранит SHA-256, Max-Age 30 дней |
| Атомарность | Контролируемая ошибка Session.create после user insert внутри транзакции | 503, user не сохранён; fault injection только границы сбоя, rollback реальный |
| A/B/rotation | Два owner cookie → GET session с чужим ownerId query, затем смена аккаунта | Каждая cookie отдаёт своего actor; новая cookie отличается, старая отозвана, второе устройство живо |
| Нейтральный вход | Неизвестный email и неверный пароль | Одинаковый 401/code/message, нет новой session cookie |
| Выход/replay | Authenticated logout дважды с тем же валидным CSRF; GET с отозванной cookie | Оба logout 204, cookie очищена, GET 401; anonymous logout с CSRF тоже 204 |
| Время | Scoped AuthClock теста: +6/+7 дней idle, активность, затем ровно +30 дней absolute | Валидный запрос обновляет idle, при границах 401, absolute не продлён; глобальные таймеры/fetch не подменялись |
| Конкуренция/rate | 5 неверных одновременно, шестой с поддельным XFF, затем +15 минут | 5×401, 429/Retry-After=900, другая пара не заблокирована, окно отпускает на границе |
| Успех/сбой | 4 ошибки→успех→5 ошибок; fault при создании Session | Успех сбрасывает ошибки, 6-й блокируется; инфраструктурный сбой не оставляет ошибочную попытку |
| Counter persistence | Исчерпанный лимит → новая API-инстанция на той же test-БД | Вторая инстанция тоже возвращает 429 |
| CSRF | Нет token, tamper, чужой context-cookie, ровно 1 час, старая preauth-подпись после register | 403; свежий bootstrap восстанавливает logout |
| CORS/OpenAPI | Preflight с X-CSRF-Token, export/live schema | Credentialed exact-origin CORS, стабильные operationId/header/cookie descriptions |
| Production flags | Контролируемый NODE_ENV/синтетический secret, HTTP fixture, 6 register попыток | __Host/Secure/HttpOnly/Path=/ без Domain, 6-я 429 несмотря на dev override 100 |

Тесты удаляют только свои случайные email (Session каскадно) и digest ключей своих login-пар; общие User/Session таблицы не очищаются. Fault injection и clock локальны приложению/кейсу, afterEach восстанавливает spies. Production HTTP fixture проверяет атрибуты, не поведение браузера через реальный TLS. Project/media/RSVP owner-resource isolation ещё не проверена: ресурсов нет, SessionGuard не выдаётся за их защиту.

Dev migration применена, повтор test migrate дал No pending migrations. Реальный dev helper/health/Swagger UI HTML/live JSON 200 проверен, аккаунты в dev не создавались; собственное дерево процессов остановлено. Финальные clean install/hosted/isolated kit отмечаются ниже по факту. Проверки произвольной негативной proxy-топологии, нагрузки, полного UI/CSRF через браузер, reset, purge и deploy не проводились.

Дополнительный реальный PowerShell 5.1 WebSession smoke на порту 3101 прошёл bootstrap/register/autologin/CSRF refresh/logout/401. Для этой проверки создан один синтетический dev-аккаунт, после проверки удалён только его точный id+email (Session каскадно), без общего cleanup. Значения cookie/токенов не выводились, дерево собственных процессов остановлено. `npm ci` успешен: 352 packages, audit 0; затем типы/обе сборки/OpenAPI/25 DB tests/8 unit повторены успешно. После строгого cookie parse и дополнительных negative assertions финальный suite проверяется ниже.

Финальный локальный suite после проверки cookie format, expired logout/login-CSRF и конкурентного release — 25/25, typecheck/build API успешны. Release сериализован FOR UPDATE, две одновременные отмены двух резервов оставляют 0, без потери decrement. Просмотрены staged diff/новые файлы, diff --check и actionlint успешны. Проверены 175 локальных путей Markdown в 38 staged-файлах (без якорей); реальные локальные env-пароли не встречаются в staged-содержимом. SHA-256 ТЗ неизменён: `276fbfd4fc094f8b1a4f8d77351370efb24b634568409d54f47f25dff1c578ac`. Hosted CI и kit пока не заявлены пройденными, их результаты ниже после факта.

Итог кода `51455ea0c13a52ce864f1bbee14da139d17844bc`:

- [Hosted CI 44075260483](https://github.com/PlykinYurij/povod-project/actions/runs/44075260483) success: Verify Ubuntu/Windows, Database integration и Build kit. На чистой disposable test-БД миграции/seed повторены, 25 tests успешны; OpenAPI регенерируется без diff.
- Полный `npm run artifact:create` Windows success: чистая snapshot-установка/типы/обе сборки, production install с ignore-scripts, изолированные native Argon2/Prisma imports, старт нового auth runtime без DB/CSRF secrets, web/health/CSS 200. Manifest digest `b1a173bcfd8d32d9c06ffcbfc5498a8c5a6796f416896887f2aa5b93ea2dadaa`, channel preview. Проверка health — liveness, не готовность публичной auth-конфигурации.
- Prettier --check окончательного кода успешен после исправления двух файлов; git status чистый перед документальным итогом. API-результат отмечен выполненным, owner/main не отмечены. Следующий коммит изменяет только отчёт/статусы и проверяется собственным CI.
