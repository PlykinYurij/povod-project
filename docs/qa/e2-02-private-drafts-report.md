# E2-02 · Приватные черновики: результаты проверок

20.11.2026, feat/private-project-drafts от main f220170 (PR #24 со схемой 654f2f4). [Карточка](../product/e2-02-private-drafts.md), FR-05/06/08, NFR-07/08; P-01/03/18. Самопроверка ведущего, не независимое ревью. Результат передаётся на Review; владелец/main не отмечены автоматически.

## Выполнено

- `npm run typecheck`: оба workspace, включая новые API-тесты — успешно.
- `npm run build`: production Next и compiled Nest — успешно; JSON-пресет включён в dist через resolveJsonModule. Сборщик комплекта копирует dist целиком; его логика не изменена.
- `npm test`: 126 тестов, 22 файла, включая пять новых transport/SDK-проверок; реальные generated create/get методы, caller-scoped cookie, сохранение idempotency key, CSRF для PATCH, отсутствие retry при 409, запрет неизвестных путей/методов. Остальные 121 — существующие регрессии.
- `npm run test:database`: 136 тестов, семь файлов; 23 новых HTTP/PG проекта + 113 регрессий identity/catalog/schema. Реальная изолированная test PostgreSQL, без mock Prisma и без очистки dev.
- `npm run db:migrate:test` и `npm run db:migrate:dev`: девятая аддитивная миграция успешно применена к двум разным локальным БД; прежние таблицы сохранены. Повторный запуск обеих команд — No pending migrations.
- `npm run api:openapi` и `npm run api:generate`: OpenAPI 0.9.0 и типы/HTTP/hooks сгенерированы из compiled Nest; повторная генерация воспроизводима по hash всех generated-файлов.
- Web и целевой API Prettier — успешно. Diff проверен, 324 локальные ссылки существуют, исходное ТЗ побайтно сохранено; конфликтных маркеров/локальных credentials в изменениях нет. Проверка импортов web подтвердила алиасы и отдельные const/let.

Первый интеграционный прогон выявил недостающий экспорт CsrfService для guards нового модуля; экспорт исправлен. Один transport test повторно использовал уже прочитанный Response — fixture заменён на создание нового ответа. Перечисленные успешные запуски выполнены после этих исправлений.

## Значимые случаи

| Проверка | Данные / действие | Подтверждённый результат |
| --- | --- | --- |
| Владелец | Создать пустой draft, прочитать, получить список, заменить payload | revision 1 → 2; все тексты/локаль/пустые поля сохраняются без перевода/trim; список без content, ответ без owner/email/hash |
| P-01 | A создал проект, B читает/сохраняет его и случайный UUID | Одинаковый 404 PROJECT_NOT_FOUND; B не видит A в списке, ownerId query/body отклонены |
| Auth/CSRF | Guest GET/POST/PATCH; owner без CSRF, с чужим origin, text/plain | 401 / 403 / 415, проект не изменяется; no-store |
| Повтор create | Один key/body, после правки, при квоте, через другой экземпляр приложения | 201 затем 200 с текущим проектом; без сброса правок/новой записи. Другое тело — 409; другой owner использует тот же key независимо |
| P-18 | Четыре черновика A, четыре конкурентных create | Один 201, остальные DRAFT_LIMIT_REACHED; всего пять; B создаёт независимо |
| Учёт квоты | Published/deleted fixtures плюс пять draft | Первые не считаются draft; published locked, deleted недоступен. Повтор deleted не восстанавливает запись |
| P-03 | Две вкладки с одной revision; повтор старого PATCH после потери ответа | Один 200, один 409; GET показывает победившее содержимое, поздний запрос его не затирает |
| Откат | Fault injection возвращает некорректный будущий пресет, insert JSONB проходит, mapper отказывает до commit | 503, нет проекта/сохранённого key; повтор с исправным пресетом создаёт один draft |
| Runtime | Неизвестные поля, неверные длины/ревизия, NUL/непарные surrogates, неизвестное фото | 422 с точным path; прежняя revision/content сохранены. Фото пока MEDIA_NOT_FOUND, без ложного owner/ready |
| HTTP/контракт | Malformed/oversized JSON, неверный UUID, испорченный сохранённый JSON, Swagger/preflight | 400/413/422/503 безопасно; OpenAPI security/headers/nullable/revision задокументированы; CORS допускает PATCH/Idempotency-Key только с настроенным web origin |

Fixture firstPublishedAt/deletedAt не означает реализацию publish/delete/pause/expiry. Fault injection не подменяет проверки гонок: все конкурирующие операции выполнялись на PostgreSQL.

## Не проверено / вне этапа

Редактор и сохранение из браузерного UI ещё не созданы. Browser E2E/макеты/новые скриншоты в этом этапе не выполнялись; есть HTTP/PG и transport/SDK-тесты. Загрузка, media ownership/processing, публикация/сроки, RSVP, expiry/purge, production/deploy остаются отдельными задачами. Полный build kit на этом шаге не выдаётся за выполненный; D-33 не является разрешением production и известный риск next-intl/picomatch не объявлен устранённым.
