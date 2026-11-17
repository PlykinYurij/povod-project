# Локальный PostgreSQL · E1-05

Windows/PowerShell, Node 26.13.0, Docker Desktop с работающим Linux engine, Compose v2+ (проверен v5.7.0). Next/Nest пока запускаются через npm в Windows; перенос проекта в WSL не нужен. Docker Desktop запускается до команд ниже. Системная установка — отдельное действие; scripts её не выполняют и не запускают Desktop автоматически.

Из корня репозитория:

```powershell
node scripts/local-db.mjs init
node scripts/local-db.mjs up
node scripts/local-db.mjs check
node scripts/local-db.mjs smoke
node scripts/local-db.mjs stop
node scripts/local-db.mjs up
```

`init` выполняется один раз: создаёт ignored `infra/local/.env.local` с тремя независимыми случайными паролями; при существующем файле отказывает, не меняя его. Пример `.env.example` не копировать как рабочий env. Windows ACL наследуется от пользовательского каталога: mode 0600 не является гарантией POSIX-прав на Windows. Не публиковать env, вывод `docker inspect`/`compose config` или container environment.

`up` ждёт readiness до 90 секунд, затем проверяет реальные TCP-входы с паролем внутри контейнера, роли, версию, изоляцию и loopback binding. `check` делает те же проверки без запуска и без изменения БД. Ошибки Docker выводятся обобщённо, чтобы не раскрывать интерполированные секреты; сначала проверить работающий Desktop, свободный порт и наличие env. `stop` сохраняет volume. Команд удаления volume/reset нет.

| Назначение | Host / port | Database | User | Пароль в локальном env |
| --- | --- | --- | --- | --- |
| Разработка | 127.0.0.1:15432 | povod_dev | povod_dev | LOCAL_DEV_PASSWORD |
| Тесты | 127.0.0.1:15432 | povod_test | povod_test | LOCAL_TEST_PASSWORD |

Для SQL-клиента WebStorm использовать эти поля и соответствующий пароль из локального файла, без публикации connection string. Приложение пока БД не потребляет; DATABASE_URL и ORM появятся в E1-06. Администратор `povod_local_admin` нужен только bootstrap; его пароль не используется приложением или тестами. Пользователь с доступом к Docker engine имеет доступ к контейнеру/секретам: это локальная среда, не граница защиты от администратора компьютера.

Порт 15432 выбран после реального отказа Windows на 5432. При конфликте остановить свой контейнер, изменить только LOCAL_PG_PORT в `.env.local`, повторить `up`. Compose публикует только 127.0.0.1. Пароли нельзя менять простой правкой env после первого запуска: официальный image исполняет init.sql только на пустом data volume. При несовпадении env и существующих ролей проверки откажут; данные автоматически не удаляются. Ротация паролей/восстановление после неполного init — отдельная явная операция. `up` не пересоздаёт роли в существующей БД.

Один container и именованный volume `povod-local_postgres-data`; dev/test разделены БД/ролями и CONNECT ACL. Это не изоляция CPU/диска и не production setup. Роли не superuser/createdb/createrole/replication/bypassrls, не состоят в группах. PUBLIC CONNECT отозван у dev/test, postgres/template1; PUBLIC CREATE отозван в public schema. Будущему тестовому reset недостаточно проверки имени: E1-06 должен проверять роль и явный test-маркер.

`smoke` только для этой локальной среды: записывает случайный синтетический marker в `e105_probe.markers` каждой БД, повторяет `up`, проверяет неизменный ID контейнера, останавливает PostgreSQL, проверяет отказ доступа, запускает вновь и читает оба marker. Не удаляет данные; маленькие marker остаются для диагностики. Это техническая схема проверки, не миграция/seed продукта. При сбое smoke может оставить контейнер остановленным: повторить `up`, данные сохранены. Сторонние/production URL script не принимает.

Образ PostgreSQL **17.12-bookworm** зафиксирован digest в Compose; обновления — явным PR с этими проверками, без смены major поверх существующего volume. Prisma сейчас не установлена. Проверено 16.11.2026: [поддержка PostgreSQL 17 до 2029](https://www.postgresql.org/support/versioning/), [Prisma поддерживает PostgreSQL 17](https://www.prisma.io/docs/orm/v7/reference/supported-databases), [официальный Docker image: init и переменные](https://github.com/docker-library/docs/blob/master/postgres/README.md). Выбор 17 даёт поддерживаемую основу; PostgreSQL 18 тоже допустима, необходимости обновления major сейчас нет.

При старом PATH script подхватывает стандартный per-user путь Docker Desktop только в дочернем процессе. Системный PATH не меняется. Для обычного `docker` в WebStorm после установки может потребоваться перезапуск IDE. Результаты — [QA E1-05](../qa/e1-05-report.md).
