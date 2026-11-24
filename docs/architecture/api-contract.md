# Начальный контракт первой вертикали

**После D-38/39:** существующие identity/catalog/private draft endpoints 0.9.0 остаются фактическим контрактом. Проектируемые self-service publish/owner resume/offer ниже — история v1, заменённая [заявками/admin publish](assisted-publication.md). Не генерировать клиент и не реализовывать их по старому Markdown. Новые API пока не вошли в Swagger.

Статус: реализованная часть отделена от проектируемых операций. Identity, read-only каталог и private draft API имеют OpenAPI 0.9.0; preview/media/publication/public пока проектируются. Источники: FR-01–14, NFR-07–10, D-02/03/09–13/36/37. Авторизация и базовые политики — [архитектура](first-scenario.md). JSON ниже — синтетические примеры.

Identity описан в authentication.md. Read-only GET /api/v1/templates?locale=ru|en → 200 `{items:[{templateVersionId,title,eventType,schemaVersion,themes:[{id,title}],blocks:[{id,required}],demoPath,previewImagePath}]}`. Default RU, неизвестные query/некорректная locale → 422. No-store, без аккаунта/БД/Set-Cookie. Пока одна реализованная wedding-garden-v1, без фиктивных остальных карточек; пути demo/image относительные. Схемы контента E2-01 и приватные черновики E2-02 реализованы отдельно; наличие catalog descriptor/schemaVersion не означает готовой публикации E2-04.

## Контент и ревизия

```json
{
  "templateVersionId": "wedding-garden-v1",
  "title": "Наша свадьба",
  "content": {
    "themeId": "sage",
    "names": {"first": "Анна", "second": "Михаил"},
    "event": {"localDate": "2027-06-12", "localTime": "16:00", "timeZone": "Europe/Moscow"},
    "venue": {"name": "Усадьба «Тихий сад»", "address": "Самара, Садовая улица, 12", "routeUrl": null},
    "program": null,
    "heroMediaId": null
  }
}
```

Точные поля — общая схема архитектора/UX, предложение A-01. В черновике names/date/time/venue могут быть пустыми строками; перед публикацией имена, дата/время/пояс, название и адрес места обязательны. Это конкретизация слова «место» D-03, требующая ревью. routeUrl опционален, только HTTPS. themeId — один из разрешённых версией шаблона (`sage`, `sand` в эскизе), произвольные стили запрещены. Неизвестные поля отклоняются, строки экранируются.

`program:null` и `heroMediaId:null` означают выключенный блок. Включённая программа — непустой массив `{time:"16:00",text:"Сбор гостей"}`; порядок блока определён шаблоном. Перестановки блоков нет. mediaId — только принадлежащий этому проекту ресурс; при публикации — ready и версия зафиксирована. D-36 заменяет прежнее исключение вступления: любой контентный текст, включая «Приглашаем разделить…», редактируется владельцем и хранится в draft/snapshot, а не остаётся скрытой константой TemplateVersion.

Контракт D-36/37: content.copy содержит все текстовые части оформления (вступление, заголовки секций, подписи и подвал), content.locale задаёт локаль служебных сообщений/форматирования независимо от кабинета. GardenContentDto и вложенные DTO описаны OpenAPI 0.8.0; renderer использует сгенерированный тип. Пример выше исторически сокращён и не включает обязательные locale/copy; полная структура — DTO. Пресет копируется при создании, при чтении не подменяет введённый текст. Служебные ошибки и заглушки берутся из i18n; произвольный контент не интерпретируется как ICU/HTML.

Пределы D-37 заменяют предложение A-02: title до 24 символов, имена до 20, venue.name до 80, address до 150, HTTPS URL до 200, до 12 пунктов программы, text пункта до 200. Все максимумы copy указаны в [карточке схемы](../product/e2-01-content-schema.md) и OpenAPI GardenCopyDto. Q-03 закрыт; счёт Unicode code points. Черновик допускает пустые значения, полнота требует непустые title/names/date/time/zone/venue.name/address и time/text включённой программы. Тексты copy могут быть пустыми и не заменяются пресетом. Пределы фото/черновиков приняты D-15; учёт версий/точные единицы ещё Q-08. Дата календарная, время HH:mm, пояс именованный IANA; прошедшая дата допустима.

Контракт E2-01: OpenAPI 0.8.0 содержит GardenDraftDto/GardenContentDto и вложенные схемы через ApiExtraModels; Orval генерирует web-типы, которые потребляет renderer. Это модели для следующих draft use cases, не новый публичный write endpoint. validateGardenDraft принимает целую структуру с пустыми строками/null, не JSON Merge Patch (partial updates с revision — E2-02). validateGardenComplete добавляет полноту, но не публикационные права/форму RSVP/готовность фото. Nullable-поля обязаны присутствовать. heroMediaId — UUID либо null, только ссылка; принадлежность/ready проверит media use case. Служебные значения не преобразуются неявно, строки владельца не обрезаются; whitespace-only обязательное значение не считается полным. Вложенные ошибки возвращаются dot paths, неизвестные поля — UNKNOWN_FIELD, прочие неверные значения — INVALID_VALUE, незаполненные при проверке полноты — REQUIRED.

Реализованный E2-02 ProjectDto включает `id, templateVersionId, title, revision, content, firstPublishedAt, createdAt, updatedAt, canEditDraft`; список items без content. ownerId/email/creationKeyHash/creationPayloadHash не отдаются. canEditDraft — подсказка, не замена owner/revision/server checks; после firstPublishedAt=false. Расширения `capabilities, media[], publication` и canPublish/canResume/canCorrectTexts появятся со своими use cases, сейчас не выдаются как работающие. Поля периода/receipt не присылаются клиентом как доверенные значения.

## Запросы

База `/api/v1`. Все project/media/preview/tariff операции ниже owner-session, кроме каталога и public. Мутации — CSRF, JSON кроме multipart. Приватные ответы no-store. Публичный каталог не содержит реальные данные владельцев.

| Метод и путь | Запрос → результат | Ошибки сверх общих |
| --- | --- | --- |
| GET `/templates` | Версии, title, schemaVersion, themes, blocks, безопасное демо → 200 | 503 |
| GET `/projects` | Реализован E2-02: `{items:ProjectSummaryDto[]}` текущего владельца, без content; query не предусмотрен | 401/422/503 |
| GET `/publication-offers` | Доступные бесплатные предложения `{id,version,price:0,durationSeconds,limits}` → 200 | 503; отсутствие предложения не разрешает публикацию |
| POST `/projects` | Реализован E2-02: Idempotency-Key UUID; `{templateVersionId,title}` → 201 ProjectDto/revision=1 с незаполненными полями и копией RU-пресета; повтор → 200 текущий проект | 404 TEMPLATE_NOT_FOUND/PROJECT_NOT_FOUND, 409 DRAFT_LIMIT_REACHED/IDEMPOTENCY_KEY_REUSED, 422 VALIDATION_FAILED |
| GET `/projects/{id}` | Состояние проекта и актуальная ревизия → 200 | 404 также для чужого проекта |
| PATCH `/projects/{id}/draft` | `{expectedRevision,title,content}`; полная замена только чернового payload → 200 с новой revision | 409 REVISION_CONFLICT/CONTENT_LOCKED, 422 |
| GET `/projects/{id}/preview?revision=N` | 200 `{templateVersionId,revision,content,media,validation:{publishable,errors},rsvp:{formVersionId,fields}}` | 409 REVISION_CONFLICT; неполные поля — 200 с errors, не ложный publishable |
| POST `/projects/{id}/media` | Idempotency-Key; multipart `file` → 202 `{mediaId,state:"processing"}` после устойчивого приёма/постановки job | 413 FILE_TOO_LARGE, 415 UNSUPPORTED_IMAGE, 422 IMAGE_LIMIT, 409 CONTENT_LOCKED |
| GET `/projects/{id}/media/{mediaId}` | 200 `{mediaId,state,privatePreviewUrl?,failureCode?}` | 404 при несовпадении владельца/проекта |
| DELETE `/projects/{id}/media/{mediaId}` | Только до первой публикации; отсоединить и запланировать безопасную очистку → 204, повтор 204 | 409 CONTENT_LOCKED/MEDIA_IN_USE; не удалять asset, пока он выбран в черновике: сначала сохранить null |
| POST `/projects/{id}/publish` | Idempotency-Key; `{expectedRevision,tariffId,tariffVersion,slug}` → 201 receipt + currentState | 409/422, см. ниже |
| GET `/public/invitations/{publicId}` | 200 `{templateVersionId,content,media,metadata,rsvp:{formVersionId,fields}}` без ownerId/title/email/черновика | 404 INVITATION_UNAVAILABLE для всех причин недоступности; 503 при сбое |

PATCH сохраняет currentRevision+1 только при совпадении expectedRevision. При потере ответа клиент читает GET: если payload уже сохранён, не посылает слепое перезаписывание; иначе предлагает сверку. Replay-гарантия публикации ниже сильнее, чем семантика PATCH.

E2-02: POST/GET/list/PATCH реализованы, preview/media/publish ещё нет. Все project query-параметры запрещены; unknown body — 422. Создание и save блокируют owner row, затем project, в транзакции. Пять draft считаются по firstPublishedAt=null/deletedAt=null; опубликованный проект, включая паузу, не возвращается в draft-квоту. Повтор create scoped owner + create + UUID, SHA-256 key/body сохранены с проектом и уникальны по owner/key. Тот же исходный payload возвращает текущую revision без сброса правок; другое тело — 409, deleted — 404. TTL не назначен: до purge Q-11/19, автоматической очистки ключей нет. До E2-03 ненулевой heroMediaId → 422 с field code MEDIA_NOT_FOUND. NUL/непарные surrogates, не представимые JSONB, отклоняются с dot path без нормализации.

Авторизация/CSRF: 401 AUTH_REQUIRED, 403 CSRF_FAILED. Общие: 429 RATE_LIMITED (Retry-After), 503 SERVICE_UNAVAILABLE, 422 VALIDATION_FAILED. Чужой ресурс — нейтральный 404, не подсказка о владельце. Ошибка:

```json
{"error":{"code":"VALIDATION_FAILED","message":"Проверьте обязательные поля","fields":[{"path":"content.venue.address","code":"REQUIRED"}],"requestId":"req-example"}}
```

503/таймаут публикации не доказывает отсутствие commit. Клиент показывает «Проверяем результат», повторяет с тем же ключом; не предлагает немедленно начать новую операцию. Статусы загрузки: `processing → ready | failed`; для клиента приём файла/обработка/готовность — разные состояния.

## Публикация и повтор

Тариф приходит из offers, durationSeconds не захардкожен в UI. Изменившийся tariffVersion → 409 TARIFF_CHANGED с необходимостью повторного подтверждения новых условий. Поля невалидны → 422 с paths; ревизия устарела → 409 REVISION_CONFLICT; фото не готово → 409 MEDIA_NOT_READY; два места заняты включая паузу → 409 PUBLICATION_LIMIT_REACHED. Предлагаемое удержание квоты освобождается только отдельной согласованной операцией, не новым ключом запроса.

```json
{
  "receipt":{"publicationId":"pub-example","grantId":"grant-example","sourceRevision":7,"publicUrl":"https://andrey-happy-birthday.example.com","firstPublishedAt":"2026-11-10T09:00:00Z","initialExpiresAt":"2027-02-08T09:00:00Z"},
  "currentState":{"visibility":"public","periodState":"running","remainingSeconds":7776000,"expiresAt":"2027-02-08T09:00:00Z","slotOccupied":true,"canEdit":false}
}
```

Числа примера условно соответствуют 90 дням, не фиксируют тариф. expiresAt — текущий прогноз при непрерывном расходе; на паузе null, остаток показан отдельно. receipt — факт первой операции, currentState — результат чтения текущего состояния в момент ответа.

| Случай | Последствие |
| --- | --- |
| Тот же ключ + то же каноническое тело после commit | 200 с тем же receipt и актуальным currentState; не создаёт новый снимок, слот, период или срок |
| Тот же ключ + другое тело | 409 IDEMPOTENCY_KEY_REUSED, не публикует |
| Конкурентный тот же ключ | Сериализовать, либо 409 PUBLISH_IN_PROGRESS + Retry-After; повтор тем же ключом |
| Другой ключ после первой публикации | 409 ALREADY_PUBLISHED, owner-only существующий receipt/currentState; не resume |
| Сбой до commit | Черновик остаётся, квота/период/receipt не расходуются; повтор допустим |
| Успех commit, ответ потерялся | Повтор разрешает неопределённость без новой выдачи |
| Replay после паузы/истечения | Старый receipt + актуальный currentState, не ложный active и не новый период |
| Replay после удаления проекта | 404 PROJECT_NOT_FOUND, не оживляет и не раскрывает старые данные |

Неуспешные бизнес-проверки не фиксируются как успешный receipt; повтор может пройти после явного исправления. Новые данные = новый ключ. TTL receipt — Q-11. Даже после очистки receipt уникальность первой публикации даёт ALREADY_PUBLISHED вместо повторного периода. Область ключа — ownerId + operation + projectId, для create/media scope уточняется объектом операции. После commit запись receipt и снимок атомарны.

## Контракты расширения (не входят в первый UI)

`POST /projects/{id}/pause` и `/resume`: Idempotency-Key и `{expectedStateVersion}` → текущий период/visibility, stateVersion+1. Resume использует тот же снимок/publicId и остаток; 409 PERIOD_EXHAUSTED/STATE_CONFLICT, slotOccupied не снимается паузой. Admin задаёт режим с причиной отдельно; обычный владелец по D-08 имеет право resume и после admin-снятия. Полный новый период — другая операция, не publish первой версии.

RSVP v1 (D-16): `POST /public/invitations/{publicId}/responses`, ключ и `{formVersionId,name,attendance,companions,answers}`. Поля формы пока предложение Q-04; сервер проверяет доступность и атомарные 300 хранимых анкет независимо от имени. Повторы после удаления записи/закрытия — отдельный Q-11, XLSX следующий этап. v1 включает фиксированную formVersion с первой публикации (D-16).

## Текстовые исправления D-17

Проектный контракт: POST /projects/{id}/text-corrections, owner-session + CSRF + Idempotency-Key, тело {expectedPublicationVersionId,changes}. Предлагаемый whitelist: content.names.first/second, content.venue.name/address, content.program[i].text только существующих пунктов. Запрещены event.*, routeUrl, themeId, mediaId, форма/вопросы/варианты, добавление/удаление элементов. Название проекта — отдельные внутренние метаданные, не часть публичной коррекции. Окончательный whitelist согласуется Q-16.

После валидации длины/текста транзакция копирует текущий снимок, меняет только разрешённые строки, создаёт immutable-версию, атомарно переключает currentPublicationId. publicationRevision увеличивается, grant/publicId/остаток/слот/formVersion не меняются. Ответ 200 {publicationId,publicationRevision,currentState}; тот же ключ/тело возвращает прежний результат без дополнительной версии, другое тело 409 IDEMPOTENCY_KEY_REUSED. Устаревший снимок — 409 PUBLICATION_VERSION_CONFLICT; запрещённое поле — 422 TEXT_FIELD_NOT_ALLOWED; удалённый проект — 404. Сбой не повреждает старый снимок. Не использовать publish для применения текстов или выдачи нового срока.

Лимиты D-15 теперь приняты: пять черновиков, 10 фото / 15 МБ / 40 Мп; варианты учёта версий фото ещё Q-08. Два проекта бесплатны, каждый получает 90 дней по D-19. При полном истечении effective slotOccupied=false должен учитываться в транзакции проверки квоты независимо от своевременности cron. Истечение даёт мягкое удаление по D-20; окончательную очистку не назначать до Q-19.

## Уточнение истечения D-19–21

Offers v1 выдаёт бесплатный период durationSeconds=7776000; каждая первая публикация фиксирует 90 дней. remainingSeconds расходуется отдельно от даты события. При полном истечении обычные project/preview/media/response/export и text-correction операции возвращают 404 PROJECT_NOT_FOUND, публичная выдача — нейтральную INVITATION_UNAVAILABLE; UI может показывать отдельную минимальную карточку «Срок истёк, данные удалены» без контента. Экспорт/восстановление soft-deleted данных требуют Q-19 и отдельного контракта, endpoint восстановления пока не вводится. Удаление физически выполняется позднее; на доступность и квоту задержка worker не влияет. Ранее выданные фото-URL отзываются в рамках TTL Q-09.

Identity FR-02–04 детализирован отдельно: [методы регистрации и входа](authentication.md). В минимальный каркас эти endpoints не входят.

## Дополнение D-25: адрес публикации

К publish body добавляется slug; 409 SLUG_TAKEN с fields.path=slug не расходует слот/период и не создаёт снимок. Ошибка формата — 422, системное имя запрещено. Предварительный GET /publication-addresses/availability?slug=... только подсказывает доступность; уникальный normalizedSlug резервируется в транзакции publish. Повтор key/body возвращает прежний URL; slug входит в requestHash. GET /public/invitations/by-address/{slug} — безопасный DTO для Next host-routing, publicId остаётся внутренним стабильным id. Канонический публичный URL теперь поддомен, прежние /i/{publicId} в документах — ранний пример, поддержку alias не считать обещанной. Детали: [публикация и адреса](publication-addresses.md).

## Фактический публичный API RSVP E3-01

OpenAPI описывает GET и POST `/api/v1/public/invitations/by-address/{slug}/rsvp`. GET выдаёт версию доступной формы, POST записывает ответ и возвращает квитанцию. Для чтения и записи нужен видимый актуальный снимок и действующий срок. [Поля, ошибки и правила повтора](../product/e3-01-rsvp-next.md).

## Фактическая операция admin publish E2-04

OpenAPI 0.20.0 добавил `POST /api/v1/admin/requests/{id}/publish`. Операция отвечает квитанцией и создаёт снимок с доступной анкетой. [Поля, ошибки и правила повтора](../product/e2-04-admin-publication.md).

OpenAPI 0.21.0 добавляет GET `/api/v1/public/invitations/by-address/{slug}` и `/cover/{snapshotId}` под тем же API-префиксом. Приватная карточка заявки возвращает квитанцию в `publication`, если публикация состоялась. [Публичное чтение и гостевой SSR](../product/e2-04b-guest-page.md).

OpenAPI 0.22.0 возвращает схему `rsvp` вместе с публичным снимком. Браузерный `POST /rsvp` на гостевом хосте пересылает ответ в Nest по версии формы. Production API применяет IP-лимит по проверенному адресу relay. [Контракт E3-01b](../product/e3-01b-guest-rsvp.md).

OpenAPI 0.23.0 добавляет приватное чтение ответов для владельца и оператора проекта без аккаунта. Оба GET-маршрута возвращают общие счётчики и строки с учётом фильтра участия. [Контракт E3-02](../product/e3-02-rsvp-dashboard.md).

В OpenAPI 0.24.0 оба кабинета получили GET `/responses/export` и DELETE `/responses/{responseId}` под своими приватными API-префиксами. Гостевой повтор удалённой записи получает 409 `RSVP_RESPONSE_DELETED`. [Контракт E3-02b](../product/e3-02b-rsvp-export-delete.md).
