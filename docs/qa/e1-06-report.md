# E1-06 · Проверки

17.11.2026, база main 4f7394d, ветка feat/database-migrations. Самопроверка ведущего; независимое ревью не проводилось. Windows/PowerShell, Node 26.13.0, npm 11.20.0, PostgreSQL 17.12 в Docker. Статус Review, не принятие/merge.

Локально выполнено:

- Prisma Client 7.10.1 с CommonJS сгенерирован; API и тесты проходят strict TypeScript. Генерация не требует DATABASE_URL.
- `db:migrate:test` применил первую committed migration к public без продуктовых таблиц, повтор успешен; существующая отдельная e105_probe не удалена. Dev migration успешна отдельно.
- `db:seed:test` и `db:seed:dev` повторены дважды; тест проверил единственность seed в test.
- `test:database`: 4 теста на реальной test-БД, включая ограничения target, identity, seed, PostgreSQL unique constraint и rollback. Suite не удаляет общие таблицы/схемы, точечный cleanup только собственного ID.
- Отдельный запуск runner с dev URL в test-target и с отсутствующим marker завершился exit 1 до миграций/тестов, без вывода credentials.
- Текущие 8 Vitest-тестов целостности артефактов, typecheck/build обоих workspace прошли. Дополнительная проверка типов тестов обнаружила несовместимый формат модуля: исправлено через .mts и NodeNext import, повтор успешен.
- `npm audit --omit=dev`: 0 известных уязвимостей на момент проверки; первоначальный audit после установки всего дерева также 0.
- actionlint проверил workflow с отдельной PostgreSQL service-БД и зависимостью build-kit; синтаксис Node scripts проверен.

`npm ci` из обновлённого lockfile успешен (327 packages, audit 0); после него полный typecheck/build, 8 unit и 4 database tests повторно успешны. Hosted CI, изолированный runtime нового kit и итоговый diff проверяются перед завершением; результаты дописываются ниже по факту. Наличие workflow не считается успешным hosted-тестом. WebStorm UI, product API/публикации, авторизация, production/restore/load не проверялись, эти функции ещё не реализованы.
