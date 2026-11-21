# V2-01 · Заявка владельца с проектом

21.11.2026, реализовано/проверено, Review; feat/project-publication-requests, база main 3626e47 + проверенная цепочка b85152b. D-38/43, FR-08/11/24, R2-03/08/09/10. Реальная публикация/админка не входят.

## Контракт для реализации · A-08

POST /api/v1/publication-requests: Session + Origin/JSON + CSRF, UUID Idempotency-Key. Контакты/technical privacyConsent по V2-02, projectId UUID, expectedRevision positive int, expectedPriceVersion positive int либо null. Сервер проверяет owner/deleted и текущую revision; не принимает owner/role/status/цену/срок от пользователя.

200 replay / 201 новый receipt RECEIVED как у общей заявки. Key scoped по actor/operation; два владельца могут использовать одинаковый UUID без доступа к чужому receipt. Новое тело со старым key — 409 IDEMPOTENCY_KEY_REUSED. Replay существующей заявки проверяется до текущей revision/прайса/открытой заявки, но после владения ресурсом. Удалённый/чужой проект — нейтральный 404.

Одна открытая заявка NEW/IN_PROGRESS на project; другой key при уже открытой — 409 REQUEST_ALREADY_OPEN, не дубль/обновление контактов. SubmittedRevision остаётся историей, **редактор не блокируется**: сохранение повышает Project.revision, а заявка не утверждает новую версию автоматически. Для публикации admin позже должен повторно увидеть и подтвердить актуальный preview; stale revision конфликтует.

Запрос допустим для сохраняемого неполного draft: это обращение к оператору, не обещание полной готовности/оплаты/публичной ссылки. Полнота, медиа/RSVP/адрес/90 дней/места проверяются в admin publish, не назначаются в момент заявки. Пока реального unpublish нет, existing firstPublishedAt marker запрещает новую заявку published проекта; после появления state machine проверка должна опираться на текущий published state D-43.

Цена берётся из Template под SHARE lock и сравнивается с expectedPriceVersion. При несовпадении — 409 PRICE_CHANGED, нужно обновить каталог/подтвердить сумму. Если цена ещё null, клиент явно отправляет expectedPriceVersion=null; snapshot тоже null и не считается бесплатным/готовым к публикации. Настроенная цена копируется в request snapshot (minor/currency/version); последующее изменение каталога не подменяет её. Реальные суммы Q-27 до public launch, не выдумываются.

GET /api/v1/projects/{id}/publication-request: private Session/owner, no-store, никаких query. `{currentPrice, request: null}` если открытой нет; иначе request содержит только requestId/kind/status/requestVersion/submittedRevision/currentProjectRevision/price/createdAt, без контактов, внутренних hash и ORM object. currentPrice — текущая стоимость, request.price — зафиксированная в заявке. Это позволяет показать изменение прайса без подмены предложения; стоимость своего сохранённого шаблона доступна и после скрытия из каталога. Не public lookup по receipt; история terminal заявок пока отдельная функция.

Новый private intake использует общую политику IP/phone rate и helper receipt/контактов V2-02, но сохраняет Session/CSRF и сам назначает customerUserId/projectId. Создание/сохранение private проекта и submit используют единый owner → project → key → request/price → rate порядок. Admin publish в будущем должен брать project до request (для анонимного проекта owner шага нет), а не вводить обратный порядок из раннего предложения.

Проверки: два владельца/гость/CSRF, nonce replay/изменённое тело/два сервера/одна открытая заявка, stale revision/прайс, snapshot не меняется, save после submit и currentRevision в статусе, published/deleted/foreign, partial unique/FK, null-прайс без fake free, strict generated private transport/no cache/queries. Один PR, отдельные review/main чекбоксы после фактических результатов.

## Приёмка

- [x] Результат/проверки: [QA](../qa/v2-01-publication-requests-report.md), [архитектура](../architecture/publication-requests.md).
- [ ] Ревью владельца.
- [ ] Интеграция в main.

Миграции dev/test применены без reset; локальный запуск по существующему dev:api:database, операции контактов — [V2-02](../operations/service-requests.md). UI редактора/формы и admin publish отдельно.
