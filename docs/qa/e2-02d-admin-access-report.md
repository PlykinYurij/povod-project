# E2-02d · Отчёт проверок

21.11.2026, feat/admin-access, база main 3626e47 + документация 034c495. Самопроверка ведущего, не независимое QA-ревью. [Карточка](../product/e2-02d-admin-access.md).

- `npm run typecheck`: оба workspace, включая colocated API-тесты, успешно.
- `npm run build`: Next.js и NestJS успешно; production не запускался.
- `npm test`: 129 проверок, 23 файла; из них 119 web, 10 artifact/startup. Три новые web transport проверки; экранов в задаче нет.
- `npm run test:database`: 147 проверок, 8 файлов, в отдельной povod_test. 11 новых admin-проверок, 136 прежних регрессий.
- `npm run db:migrate:test` / `npm run db:migrate:dev`: новая десятая миграция применена без reset. Повторная проверка состояния — существующим migrate deploy; данные не очищались.
- `npm run api:openapi` / `npm run api:generate`: OpenAPI 0.10.0 и Orval; повторная генерация совпадает по SHA-256 generated дерева.
- `npm run format:web` и Prettier для изменённых administration TS/MTS, module/application config и local role scripts: успешно.

Проверены HTTP auth/error/cache, подмена роли, два пользователя, grant/revoke без перевхода, отозванная session, default USER/SQL default, отказ grant неподтверждённому/несуществующему аккаунту, запрет remote/mismatched test/production, реальный CLI grant/revoke на синтетическом пользователе, отсутствие публичного write role endpoint, запрет role/isAdmin при регистрации, OpenAPI security/errors. Фикстуры и их сессии удалены только по UUID текущего прогона.

Первый PG прогон обнаружил две старые проверки номера OpenAPI 0.9.0; проверки содержимого DTO/маршрутов прошли. Дублирующие проверки версии удалены из старых catalog/projects тестов, версия нового контракта проверяется в admin-наборе; повторный полный прогон зелёный. Первоначальные ошибки typecheck в новом тесте исправлены типизированным ApiErrorDto, не отключением strict.

Browser E2E, admin UI/реальные заявки/publish, полный build kit, нагрузка/production/аудит выдачи ролей не проверялись: вне объёма. Новых зависимостей/workflow нет, действующие dev-аккаунты не повышались. Правило D-43 задокументировано, но текущая схема ещё не имеет реального unpublish; соответствующая реализация отдельными карточками.
