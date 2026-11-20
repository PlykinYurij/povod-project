# E2-01b · Read-only каталог

20.11.2026, feat/template-catalog от main de0cae2. [Карточка](../product/e2-01b-catalog.md), [дизайн](../design/template-catalog.md). Проверка исполнителем; не независимое ревью, принятие/main — отдельно.

| Требование | Исходные данные / действие | Результат |
| --- | --- | --- |
| FR-01, NFR-07 | Настоящий Nest без DATABASE_URL, анонимный GET каталога | 200, один существующий шаблон, только public metadata, no-store/no Set-Cookie. Никаких аккаунтов/проектов не создано |
| FR-25 | GET с locale ru/en; неверная/повторная locale и неизвестные query | Названия/палитры локализованы, templateVersion/order стабильны; неверные query → 422 |
| FR-01/05 | Главная → SSR-каталог → демо → каталог | Реальный API + production Next прошли. Нет притворного создания проекта/публикации |
| NFR-07/08 | Cookie/Authorization/CSRF в исходном контексте, опасные href/image URL, дубликаты key, повреждённый JSON shape | Публичный fetch omit и без секретных headers; вредоносные/повреждённые данные не попадают в ссылки UI, неизвестные API-пути и POST по transport заблокированы |
| NFR-01/06 | Chrome 1280×1000 и 360×1000, Tab к demo-link | Нет горизонтального скролла, focus/основная ссылка доступны, desktop/mobile просмотрены |
| Loading/empty/error | Тестовый HTTP-прокси возвращает задержку, items:[], 503 или повреждённый payload | Четыре состояния различаются; retry восстанавливает реальные данные, diagnostics в UI отсутствуют. Это симуляции границы API, не утверждение, что настоящая registry стала пустой |
| Контракт | Compiled OpenAPI 0.7.0 → Orval → typed page | Схема/модели вложенных DTO и operationId проверены реальным HTTP-набором; generated-файлы вручную не менялись |

## Выполнено

- `npm test`: 121 успешная проверка, включая 111 frontend. Тесты вблизи catalog-view/load/validation/transport.
- `npm run test:database`: 63 успешных проверки; из них 8 новых настоящих HTTP-проверок каталога без DATABASE_URL и прежние 55 identity/PG. Новый тест расположен рядом с API-модулем и включён в существующий integration runner/CI. Этот runner по-прежнему требует безопасную test-БД для остального набора.
- Types обоих workspace и build web/API прошли. Format и повторная генерация OpenAPI/Orval успешны; generated-дерево воспроизведено побайтово.
- Реальный production-browser: собственный Nest без DB, собственный Next, отдельный Chrome/profile/порты, no user credentials. Позитивный путь проходил через настоящий API; отдельный тестовый proxy моделировал сбои. Cookie/token к публичному API не передавались, внешних browser-запросов нет, JS errors 0. Сервисы владельца не остановлены и не изменены.

Подробный JSON/скриншоты — локальная игнорируемая `.verification/template-catalog`. Штатного браузерного E2E script в CI пока нет; новый HTTP-набор работает в существующем DB integration job. UI/метаданные пустого ответа и сбоев отдельно покрыты DOM/unit tests, не выдаются за настоящие продукты.

## Не выполнено / пределы

Создание/сохранение проектов, выбор templateVersion для draft, shared content schema, upload, publish, RSVP не входят. Полные E2-01/E2-01b ещё не закрыты, Q-03/04/08 остаются. Нагрузочный/cross-browser/полный WCAG-аудит, deployment и production не выполнялись. Новых dependencies/миграций нет. Исходное ТЗ не менялось. Новый CI и build-kit оцениваются по фактическому SHA, не по прошлым зелёным прогонам.
