# E1-05 · Фактические проверки

16.11.2026, Windows 11 / PowerShell, Node 26.13.0, npm 11.20.0; Docker Desktop 4.99.0, Engine 29.9.3 Linux amd64, Compose 5.7.0. База main bd48bee, ветка feat/local-postgres. Самопроверка ведущего, независимое QA-ревью не проводилось. Статус Review.

| Кейс | Выполнено | Результат |
| --- | --- | --- |
| DB-01 | Официальный image 17.12-bookworm скачан; init/up/check; сервер сообщает 170012; Docker inspect проверен программно только на port bindings | PASS: 17.12, 127.0.0.1:15432; начальный 5432 отклонён Windows, выбран проверенный свободный 15432 |
| DB-02 | В каждой БД TCP/password psql возвращает current_database/current_user; проверены pg_roles flags | PASS: povod_dev/povod_test соответствуют назначению; superuser/createdb/createrole/replication/bypassrls=false |
| DB-03 | Каждая роль со своим верным паролем подключается к чужой БД | PASS: psql exit 2, permission denied for database для обеих ролей, не просто неверный пароль |
| DB-04 | smoke записывает случайный marker в отдельную техническую схему обеих БД, stop/up, повторное чтение | PASS: оба marker сохранены, volume не удалялся |
| DB-05 | Повтор up в smoke; сравнение container ID | PASS: контейнер не заменён, роли/данные сохранены |
| DB-06 | Первоначальный bind 5432 отклонён; отдельно stop → check → up | PASS: отказ запуска/проверки имеет ненулевой код, после up проверки успешны |
| DB-07 | Просмотр новых файлов/diff, проверка игнорирования env и отсутствия его значений в tracked-кандидатах | PASS после финальной проверки состава коммита; реальные secrets не коммитятся |

Финальная проверка staged-состава: 15 файлов, 95 локальных путей Markdown существуют (якоря не проверялись); значения трёх реальных паролей не встречаются в staged-файлах, `.env.local` игнорируется Git. `git diff --cached --check` успешен, полный diff просмотрен. SHA-256 исходного ТЗ сохранён: `276fbfd4fc094f8b1a4f8d77351370efb24b634568409d54f47f25dff1c578ac`.

Реальные команды из корня:

```powershell
node --check scripts/local-db.mjs
node scripts/local-db.mjs init
node scripts/local-db.mjs up
node scripts/local-db.mjs smoke
node scripts/local-db.mjs init
node scripts/local-db.mjs stop
node scripts/local-db.mjs check
node scripts/local-db.mjs up
npm test
npm run typecheck
npm run build
```

Первый init/up/smoke успешны после смены порта. Второй init ожидаемо exit 1 и не перезаписал env; check на остановленном контейнере exit 1. Финальный up успешен. npm test: 8 существующих тестов целостности артефакта, не тесты БД; typecheck/build обоих workspace успешны. SQL/интеграционную часть E1-05 проверяет отдельный smoke. Внешних npm-зависимостей не добавлено, lockfile неизменён.

Проверки TCP-аутентификации исполнялись psql внутри контейнера по 127.0.0.1; публикация host-порта проверена Docker bindings. Подключение из SQL-клиента WebStorm вручную не проверялось. Не проверялись Prisma/CI-БД/миграции, HTTP readiness, production, нагрузка, backup/restore или очистка тестовых данных. Init только для пустого volume; сценарий частично прерванного bootstrap не восстанавливается автоматически. Локальный административный доступ Docker не ограничен ACL dev/test. Синтетические marker и volume сохранены; финально PostgreSQL работает.
