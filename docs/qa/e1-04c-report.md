# E1-04c · Проверки backend восстановления

18.11.2026, Windows/PowerShell 5.1, Node 26.13.0/npm 11.20.0; база main `0a4fa0b`. [Карточка](../product/e1-04c.md), [локальная приёмка](../operations/password-reset.md). Самопроверка ведущим, без независимого субагента.

Выполнено:

- `npm run typecheck` — оба workspace, включая новые тесты. Первоначальные ошибки unknown JSON в тестах исправлены, финальный запуск успешен.
- `npm run build` — web/API; после изменений backend его build повторён успешно. Shared StrongPassword сохраняет прежние правила регистрации; новые DTO используют их же.
- `npm run api:openapi` — snapshot 0.3.0 регенерирован из сборки; live Swagger schema проверена в интеграционном тесте. Клиент Orval пока не создаётся.
- `npm test` — 8/8 проверок комплекта, без БД.
- `node scripts/local-db.mjs check` — PG 17.12, роли/изоляция/loopback подтверждены. Новая миграция применена к test и dev, без reset.
- `npm run test:database` — 43/43, четыре файла; из них 18 новых reset-проверок, остальные 25 — регрессия БД/регистрации/сессий. Реальный PostgreSQL и HTTP, не mock транзакции.

| Данные / действие | Подтверждённый результат |
| --- | --- |
| Существующий и неизвестный синтетический email | Одинаковый 202/body/no-store, без session-cookie/кода; неизвестному нет письма |
| Локальный inbox, валидный код, два браузера | 204, старые Session → 401, старый пароль не подходит, новый работает; автовхода нет |
| Чужой email/неверный/истёкший/повторный код | 400 без изменения аккаунта; точная граница 10 минут; пятая ошибка исчерпывает код |
| Resend, запоздалое письмо, параллельный confirm/пять неверных попыток | Старый код не активируется, единственный успешный confirm, счётчик попыток без потери инкремента |
| Владельцы A/B, concurrent login/reset | Reset A не меняет B; вход со старым паролем не оставляет Session после завершившегося reset |
| Параллельные запросы email, разные email с одного IP, поддельный XFF | Три/email/час и десять/IP/15 минут; 429/Retry-After; точное окончание email-окна |
| Сбой mail/БД/ошибка после реального updateMany отзыва Session | Нет ложного подтверждения; неотправленный код неактивен; реальная транзакция откатывает пароль/сессии/потребление кода, повтор после восстановления успешен |
| Invalid DTO/extra fields/не-ASCII пароль/нет CSRF | 422/403; production запрещает файловый mail transport |

Реальный `dev:api:database` helper запущен на свободном loopback-порту. Синтетический dev-аккаунт прошёл register → request → письмо в `.local-mail/` → confirm → 401 старой Session/старого пароля → 200 нового login. `/health` и Swagger HTML — 200. После smoke удалён только созданный аккаунт/его auth fixtures и его письмо; дерево собственных процессов остановлено. Пароли, коды, cookie, DB URL не выводились.

Не проверены и не заявлены: web UX/E2E, SMTP/реальные адресаты, production TLS/proxy/load/timing uniformity, worker/retry/retention. Файловая доставка — исключительно local. Регистрация D-30 остаётся E1-04d/Q-21, не исправлена reset-задачей. Сроки публикации/RSVP не менялись.

Hosted CI и сборка isolated kit будут записаны после фактического выполнения. Принятие владельцем и merge не отмечены.

Код `dc990eb9741d934904e2d5ed99ccaa2d93b42568`: [CI 44269526421](https://github.com/PlykinYurij/povod-project/actions/runs/44269526421) — успешно все четыре jobs: Verify Windows/Linux, Database integration и Linux build kit. Windows isolated kit проверяется отдельно; его результат ниже по факту.

Чистая установка не меняла lockfile, но актуальный audit выявил одну advisory picomatch ReDoS, пять high entries в dev-цепочке Vitest. `npm audit --omit=dev --json` — 0 findings. Общий audit **не зелёный**; отдельная [E1-02b](../product/e1-02b.md) для оценки/исправления без случайного downgrade. Это существующее дерево зависимостей, E1-04c не добавляла npm packages. Сборка/тесты успешны независимо от этого незакрытого finding.

Windows isolated kit кода dc990eb9741d934904e2d5ed99ccaa2d93b42568 успешно создан через npm run artifact:create из git archive, с чистой npm ci, повторной типизацией/сборками, native Argon2/Prisma imports и runtime вне репозитория. Web/health/staticAsset — 200. Preview manifest SHA-256: 78f89b6a15b96916387d5d552b3a1805ac08fe72d3389dc901c630486254b6c1. Каталог: artifacts/dc990eb9741d934904e2d5ed99ccaa2d93b42568-win32-x64-local-5c4b6a5d-479f-4bea-89ef-86d1f6f20d0e-1 (локальный ignored). Это проверка готового runtime, не SMTP/reset через production transport. Последующий коммит меняет только документы/отчёт, новый runtime SHA для него не заявляется.

Просмотрены diff и новые файлы, diff --check, исходное ТЗ побайтно неизменно; 194 локальные Markdown-ссылки проверены до коммита кода. Локальные credentials отсутствуют в изменениях, inbox игнорируется. Backend готов к owner review; web и production-условия не приняты за выполненные.

`npm run artifact:verify -- <каталог выше> dc990eb9741d934904e2d5ed99ccaa2d93b42568 78f89b6a15b96916387d5d552b3a1805ac08fe72d3389dc901c630486254b6c1 --allow-preview` — verified true. Заключительные изменения только в документах; дополнительно проверены 82 локальные ссылки в них, без проверки якорей.
