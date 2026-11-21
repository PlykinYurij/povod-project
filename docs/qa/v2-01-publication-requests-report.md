# V2-01 · Заявка с собственным проектом

21.11.2026, feat/project-publication-requests, main 3626e47 + проверенные зависимости b85152b. Самопроверка ведущего, не независимое QA-ревью. [Карточка](../product/v2-01-project-publication-request.md).

- Typecheck web/API и colocated tests успешен.
- Build Next.js/NestJS успешен, без production release.
- npm test: 159 / 26 файлов (149 web + 10 artifact/startup), девять новых SDK/validation проверок.
- npm run test:database: два последовательных диагностических прогона по 223 / 11 файлов, все успешны (25 новых private-request + 198 регрессий).
- Первый параллельный запуск DB-проверок вернул общий отказ без подробностей. Причину по этому выводу установить не удалось; в двух следующих полных диагностических прогонах сбой не воспроизвёлся. Не выдаём первый запуск за успешный и не приписываем ему доказанную причину.
- Тринадцатая миграция snapshot цены применена dev/test, без изменения прежних контактов/проектов и reset; повтор deploy — без pending.
- OpenAPI 0.13.0 → Orval воспроизводим; format web/изменённых API файлов успешен.

HTTP/PG: Session/CSRF, owner/foreign/admin-as-other-owner/deleted/absent, request без публикации и без freeze, успешный save после submit, submitted/current revisions, stale revision, повтор после edits/price change/published fixture, actor-scoped key, другое тело, гонка ключей/две API инстанции/одна открытая заявка, гонка save/submit, quote snapshot/current price, PRICE_CHANGED, retired template private quote, семь invalid/server-owned случаев, published new-request отказ, null state/strict query/path, DB snapshot CHECK, private rate denial/replay, rollback освобождает owner/project locks, OpenAPI security.

Frontend SDK: private credentials/CSRF bootstrap/caller nonce, серверный mutation требует явный контекст, GET no-store/cookie и раздельные цены, отсутствие заявки, malformed/extra/private/coercion payload отклоняется, GET state не позволяет mutation/query injection. UI этих сценариев пока не реализован; browser E2E и визуальное ревью не заявлены.

Контакты/receipt/rate helper переиспользованы с общей заявкой, её прежний payload hash сохранён при рефакторинге. ProjectAccessService — общая owner/read/lock проверка для CRUD и intake; порядок owner → project единый. Фикстуры только povod_test, Requests удаляются по созданным hash до удаления своих User/Project; прайс code-owned seed восстанавливается после проверки. Новых dependencies/CI нет, исходное ТЗ не менялось.

Публичная цена/юридические условия/retention и настоящий admin publish не закрыты этими тестами. D-43 проверен для редактирования после заявки; реальное unpublish появится отдельным этапом и заменит исторический firstPublishedAt-only marker.
