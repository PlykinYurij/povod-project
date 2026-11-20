# E2-02 · Приватные черновики и ревизии

Ветка feat/private-project-drafts от main f220170, содержащего принятую схему 654f2f4. Один backend PR: FR-05/06/08, NFR-07/08, D-02/15/36/37; P-01/03/18. Редактор, preview, фото, публикация и RSVP не входят.

Реализовано и передаётся на Review: [QA](../qa/e2-02-private-drafts-report.md), [запуск/ручная приёмка](../operations/private-drafts.md). Принятие владельцем и интеграция в main ещё не отмечены.

## Контракт и результат

- POST /api/v1/projects: session + JSON/origin/CSRF, Idempotency-Key UUID; body templateVersionId/title. Только wedding-garden-v1; сервер создаёт RU-пресет с незаполненными именами/событием/местом, null program/photo, revision=1. 201 новый, 200 повтор. До пяти неопубликованных неудалённых проектов на владельца.
- GET /api/v1/projects и /api/v1/projects/{id}: только проекты владельца, no-store; чужой/удалённый/неизвестный ID — одинаковый 404 PROJECT_NOT_FOUND. Список без контента, полный ответ по ID.
- PATCH /api/v1/projects/{id}/draft: session + JSON/origin/CSRF; expectedRevision/title/content, **целиком черновой payload**, не merge отдельных JSON keys. Незаполненность разрешена принятой схемой. Успех 200 и revision+1; устаревшая версия — 409 REVISION_CONFLICT, первая публикация — 409 CONTENT_LOCKED. Версию шаблона/владельца/срок/статусы клиент менять не может.
- Ошибки типов/неизвестных полей/длин — 422 с dot paths. До media-модуля ненулевой heroMediaId отклоняется как MEDIA_NOT_FOUND, ни существование, ни готовность чужого фото не раскрываются. Непредставимые в PostgreSQL JSONB NUL/непарные Unicode surrogates — 422, без молчаливой замены текста.

Ответ по ID: id/templateVersionId/title/revision/content/firstPublishedAt/createdAt/updatedAt/canEditDraft. ownerId, ключ повтора/hash, email и приватные данные не отдаются. canEditDraft не разрешение publish. Список возвращает items с метаданными без content. Реальные опубликованные проекты ещё не создаются.

## Повтор, транзакции и зависимости

Создание сериализуется блокировкой строки владельца, затем lookup key → квота → insert в одной транзакции с явным ReadCommitted: после ожидания lock счётчик видит предыдущий commit, а не устаревший snapshot. Owner + create key сохраняются с проектом, с уникальным constraint; ключ/исходное каноническое тело хранятся как SHA-256. Тот же ключ/исходные templateVersionId/title возвращает текущий проект без нового места/сброса правок. Другое исходное тело — 409 IDEMPOTENCY_KEY_REUSED. Удалённый проект не восстанавливается повтором. Срок очистки этих данных не придуман: Q-11/19 решаются до purge, пока автоматического удаления ключей нет.

Сохранение использует тот же порядок owner → project и условие expectedRevision/firstPublishedAt/deletedAt. Ревизия монотонна; два одновременных сохранения дают один успех/один conflict. Разные владельцы блокируют разные строки. Дата события/90 дней и публикационные места не участвуют в draft-квоте; опубликованные/soft-deleted записи не считаются черновиками. Пауза опубликованного проекта не делает его черновиком.

## Приёмка и проверки

Реальные HTTP + изолированная test PostgreSQL: отсутствие сессии/CSRF, два владельца, чтение/список/изменение, 5/6 и конкурентный последний слот, повтор create/другое тело/потерянный ответ после сохранения, две вкладки, rollback, locked/deleted fixtures, вложенная валидация и безопасные ответы. Fixtures published/deleted — подготовка теста, не реализованные операции публикации/удаления.

Новая аддитивная SQL-миграция и Prisma-модель; повтор migrate на dev/test без reset; сохранность имеющихся таблиц/тестов. OpenAPI → Orval воспроизводимы; SDK transport только строго перечисленные private project paths, request-scoped credentials, PATCH с CSRF. Typecheck/build/format/root/API-регрессии; diff/immutable ТЗ. Итоговые результаты записываются в QA и preparation-status; до завершения не считаются пройденными.
