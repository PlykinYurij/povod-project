# Заявка на свой проект · V2-01

Реализованная часть ветки feat/project-publication-requests, ещё не main. [Контракт](../product/v2-01-project-publication-request.md), [QA](../qa/v2-01-publication-requests-report.md), [общая заявка](service-requests.md).

POST /publication-requests требует Session/CSRF/Origin/JSON; actor назначается сервером. General assistance остаётся без Session и не становится private API. Оба пути используют DTO контактов, nonce/receipt/result и PG rate, но разные creation-key namespaces; приватный включает actorId. Helper receipt не возвращает ORM строку или текущие контакты/status.

В create transaction: User owner lock → Project lock/ownership → namespaced key/replay → published/open/revision checks → Template price SHARE lock/expectedVersion → rate → INSERT PUBLICATION request + consent + quote snapshot. Повтор принятого запроса не меняет submittedRevision, даже если проект уже сохранён заново. Другая открытая заявка не создаётся, DB partial unique остаётся последней защитой.

ProjectAccessService экспортирован ProjectsModule и используется самими get/create/save и запросом: одно правило нейтрального 404, owner → project порядок и отсутствие доверия к ownerId из body. Администратор не получает обход private owner API одним наличием role; операторские действия будут отдельными routes/use cases. Будущий admin publish должен согласовать такой же порядок project до request и перепроверять роль/revision внутри транзакции. Для general create-from-request без существующего проекта нужен отдельный порядок, не обратная блокировка уже существующего Project.

Заявка ссылается на проект и историческую submittedRevision, не копирует весь JSONB. Она **не блокирует** save и не выдаёт URL/период/место. Неполный валидный draft допустим для обращения, readiness проверяется до admin publish. Public snapshot, форма RSVP и срок публикации ещё не созданы.

price_snapshot_minor/currency/version добавлены к ServiceRequest отдельной аддитивной миграцией. Все три null означают отсутствие прайса, не free; CHECK запрещает частичный snapshot. Настроенная стоимость фиксируется после сравнения expectedPriceVersion. Повышение цены каталога позже не меняет заказ незаметно. Реальные суммы не выдуманы, Q-27 к public launch.

Private GET state читает Project/открытую заявку/currentPrice в одном RepeatableRead snapshot; только минимальные метаданные, без контактов/hash/customer ID. Заявка показывает submittedRevision, проект — currentProjectRevision. currentPrice и зафиксированная request.price независимы. Для скрытого, но поддерживаемого существующего дизайна private quote остаётся доступен. Read-only query не блокирует редактирование; submit использует актуальную блокируемую строку цены и при изменении возвращает 409.

Историческая marker-проверка firstPublishedAt ещё действует до реальной state machine; реальное unpublish должно вернуть edit и возможность нового обращения по D-43. Не подменять это наличием когда-либо оплаченного периода. Терминальные заявки/история и операторские статусы — последующие части V2-03/05, пока GET возвращает только открытую.
