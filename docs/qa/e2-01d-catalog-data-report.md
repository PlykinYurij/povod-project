# E2-01d · Проверки каталога категорий/версий/цен

21.11.2026, feat/template-catalog-data от main 3626e47 + E2-02d ab2e9bd; owner review/main отдельно. Самопроверка, не независимое ревью.

- Typecheck обоих workspace успешен, включая API colocated тесты и новый frontend DTO.
- Build Next.js/NestJS успешен; публикации production не было.
- npm test: 143 проверки, 24 файла (133 web + 10 artifact/startup).
- npm run test:database: 163 проверки, 9 файлов (16 новых catalog-data + 147 регрессий). Повторный прогон с блокировкой доступности успешен.
- Одиннадцатая аддитивная миграция применена в dev/test без reset; повтор deploy — без pending. Не было UPDATE/удаления пользовательского content.
- OpenAPI 0.11.0 → Orval; повтор генерации проверяется по digest generated дерева, format — существующим Prettier.
- Реальный SSR smoke: отдельные собственные API/Next процессы на временных loopback-портах, GET /templates показывает DB Garden/ненастроенную цену; birthday API пуст, не unavailable. Процессы остановлены, пользовательские серверы/сессии не менялись.

HTTP/PG: категории RU/EN и фильтр/unknown/invalid/duplicate, null/синтетическая integer цена/version, скрытие template/version/category, 404 нового create при сохранении replay и save старого draft, неизвестный renderer, SQL price/partial unique/FK, JSONB/revision сохранены после отказа FK, SHARE lock держится до commit и блокирует update, без БД каталог 503/liveness 200, OpenAPI public security/schema. Фикстуры только povod_test, пользователи удалены по UUID этого прогона, seed metadata восстановлены.

Frontend: public filter credential boundary/allowlist, generated fetch, currency/category response guard, отсутствие бесплатного обещания при null, RU-format minor units, прежние loading/empty/unavailable и XSS-экранирование. Первый typecheck выявил fixture без нового categories; исправлен fixture, не ослаблен контракт. Старый тест «каталог без DB» обновлён, так как каталог теперь хранится в PostgreSQL; независимость /health проверена отдельно.

Browser E2E/визуальный mobile-review, нагрузка, новый набор оригинальных оформлений, реальные цены, admin catalog-edit UI, заявки/publish и production не проверялись/не созданы этим этапом. Новых зависимостей/CI/workflow нет. Не считать инфраструктуру денег онлайн-платежами.
