# Prisma и локальные миграции · E1-06

Prisma/client/adapter-pg **7.10.1**, pg 8.16.3, TypeScript 5.9.3, Node 26.13.0. Prisma 8 в npm latest — RC, поэтому выбран стабильный 7.10.1. Проверено 17.11.2026: [генерация CommonJS](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators), [Prisma Config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference), [явная генерация](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client). Это развитие принятого D-27, не новая ORM.

**PostgreSQL не HTTP-сервис:** 127.0.0.1:15432 проверяется SQL-клиентом или командами, браузер не покажет страницу. Подключение WebStorm описано в [локальной инструкции](local-postgres.md). Перед началом запустить Docker Desktop; из корня:

```powershell
npm ci
node scripts/local-db.mjs up
npm run build --workspace=@povod/api
npm run db:migrate:dev
npm run db:seed:dev
npm run db:migrate:test
npm run db:seed:test
npm run test:database
npm run typecheck
npm test
npm run build
```

Если `.env.local` ещё нет — сначала `node scripts/local-db.mjs init`, только один раз. Generated Prisma Client игнорируется Git и создаётся явно перед typecheck/build; генерация не подключается к БД. SQL/schema/migrations хранятся в apps/api/prisma. Сборка API включает generated TS в dist; фабрика createDatabaseClient возвращает клиент, caller обязан вызвать `$disconnect()`. Nest AppModule пока его не подключает: `/health` остаётся независимым liveness. Сам клиент можно использовать в следующих use-case/provider без копирования создания адаптера.

Единственная первая модель — DatabaseProbe, техническая проверка доступа. Seed с ID e106-synthetic-seed не создаёт пользователей или бизнес-данные. Команды seed требуют предварительной сборки API и применения миграций. Повторные migrate/seed разрешены. Миграции применяются через migrate deploy, уже опубликованный SQL не редактировать. Будущие изменения оформлять новым reviewed SQL; migrate dev требует отдельной shadow-БД/прав и пока не предлагается как рабочая команда. schema push/reset/drop в scripts отсутствуют.

Local runner принимает только команды migrate/seed/test и явный dev/test. Он берёт пароль из уже созданного ignored env. Сторонний DATABASE_URL не выбирает target. Для disposable CI используются **POVOD_TEST_DATABASE_URL** и обязательный **POVOD_TEST_DATABASE=povod_test**. Поддерживаются только loopback URL с именем/ролью povod_test без query/fragment; затем проверяются реальные current_database/current_user и отсутствие admin-флагов. Не использовать эти переменные для внешней, production или проброшенной через tunnel БД. Это защита от случайной ошибки, не от администратора, подменившего локальный сервер. До проверки никаких миграций/seed/test-записей нет. Ошибки subprocess обезличены; они не печатают connection string.

`test:database` запускает отдельный Vitest config и требует build + migration + seed. Обычный `npm test` остаётся suite артефактов без БД. Тесты БД проверяются TypeScript отдельно. Каждая изменяющая проверка выделяет случайный ID и удаляет только его, без массовой очистки и без reset. Seed и marker E1-05 сохраняются. При падении, прервавшем finally, может остаться синтетическая запись; автоматической широкой очистки нет.

CI Database integration — отдельный PostgreSQL container на каждый job; bootstrap role создаёт только непривилегированную povod_test и test-БД. Пароли в workflow/infra/ci/test-database.sql — публичные синтетические значения исключительно для disposable CI, не локальные/production secrets. Миграция и seed применяются дважды. Build kit ждёт database/verify и явно падает при провале любой зависимости, чтобы skipped-job не выглядел успешной обязательной проверкой. Внешние настройки branch protection не менялись.

API build-kit теперь содержит committed schema/SQL и generated runtime. Production-зависимости ставятся с --ignore-scripts, Prisma runtime использует JS driver adapter. Изолированный smoke дополнительно проверяет импорт фабрики/adapter из распакованного runtime, не обращаясь к исходным node_modules. Prisma CLI — dev dependency и не является production migration runner. Серверный выпуск/credential separation/schema compatibility/backup и исполнение release migration ещё E1-03/03b, не реализованы; этот kit не обещает автоматический deploy БД.

npm 11.20 может предупреждать о lifecycle scripts prisma/@prisma/engines без allowScripts. Они не разрешены глобально: используется явный pinned CLI generate/migrate, которому может понадобиться загрузка engine. Проверки clean CI и artifact показывают фактическую работоспособность; установка системного Prisma CLI не нужна.
