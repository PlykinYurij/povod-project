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

Итог для кода `cde6659dc216519c0b1cd55049212db43bbc0fcc`:

- [CI 44037371902](https://github.com/PlykinYurij/povod-project/actions/runs/44037371902) — success всех четырёх jobs: Verify Windows/Linux, Database integration, Build kit. Disposable CI-БД прошла чистую миграцию, повтор deploy/seed и suite. Намеренно красный hosted job для проверки gate в этом этапе не запускался; gate проверен actionlint и просмотром логики.
- Полный `npm run artifact:create` на Windows — success из committed snapshot: clean install/typecheck/build, production-зависимости с ignore-scripts, импорт фабрики Prisma/adapter из распакованного kit вне репозитория и HTTP `/`, `/health`, CSS — 200. Manifest SHA-256 `380a8dde938fd422fa8b173471bf40982221fd40b7f12251a37f8b5988df3587`, channel preview. Миграции и schema упакованы с тем же SHA; release migration runner не реализован.
- Просмотрены diff и новые файлы; staged diff --check успешен. В 31 staged-файле не найдено значений локальных паролей; проверены 139 локальных путей Markdown (без якорей). Generated client/env не попали в Git. SHA-256 исходного ТЗ прежний: `276fbfd4fc094f8b1a4f8d77351370efb24b634568409d54f47f25dff1c578ac`.

Последующий коммит обновляет только результаты проверок/статусы; его CI фиксируется отдельно, не приписывается исходному code SHA.
