# Начальный контракт первой вертикали

Статус: предложение для проектирования, не реализованный API/OpenAPI. Источники: FR-01–14, NFR-07–10, D-02/03/09–13. Авторизация и базовые политики — [архитектура](first-scenario.md). JSON ниже — синтетические примеры.

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

`program:null` и `heroMediaId:null` означают выключенный блок. Включённая программа — непустой массив `{time:"16:00",text:"Сбор гостей"}`; порядок блока определён шаблоном. Перестановки блоков нет. mediaId — только принадлежащий этому проекту ресурс; при публикации — ready и версия зафиксирована. Фиксированный текст «Приглашаем разделить…» принадлежит шаблону, не является скрытым редактируемым полем.

Предлагаемые технические пределы A-02: title 1–100 символов, имена 1–80, venue.name 1–160, address 1–300, URL до 2048, до 12 пунктов программы, text пункта 1–200. До публикации minLength не применяется к незаполненным обязательным полям. Максимумы/число пунктов — кандидаты для согласования Q-03, не принятое правило. Пределы фото/черновиков приняты D-15; учёт версий/точные единицы ещё Q-08. Дата проверяется как календарная, время HH:mm, пояс IANA; прошедшая дата допустима.

Ответ проекта включает `id, templateVersionId, title, revision, content, firstPublishedAt, capabilities, media[], publication`. capabilities — серверные подсказки `canEdit/canPublish/canResume`, не замена серверной авторизации. После firstPublishedAt canEditDraft=false, canCorrectTexts=true; точный whitelist ниже. Поля периода/receipt не присылаются клиентом как доверенные значения.

## Запросы

База `/api/v1`. Все project/media/preview/tariff операции ниже owner-session, кроме каталога и public. Мутации — CSRF, JSON кроме multipart. Приватные ответы no-store. Публичный каталог не содержит реальные данные владельцев.

| Метод и путь | Запрос → результат | Ошибки сверх общих |
| --- | --- | --- |
| GET `/templates` | Версии, title, schemaVersion, themes, blocks, безопасное демо → 200 | 503 |
| GET `/publication-offers` | Доступные бесплатные предложения `{id,version,price:0,durationSeconds,limits}` → 200 | 503; отсутствие предложения не разрешает публикацию |
| POST `/projects` | Idempotency-Key; `{templateVersionId,title}` → 201 проект с revision=1 и частичным content | 404 TEMPLATE_NOT_FOUND, 409 DRAFT_LIMIT_REACHED, 422 VALIDATION_FAILED |
| GET `/projects/{id}` | Состояние проекта и актуальная ревизия → 200 | 404 также для чужого проекта |
| PATCH `/projects/{id}/draft` | `{expectedRevision,title,content}`; полная замена только чернового payload → 200 с новой revision | 409 REVISION_CONFLICT/CONTENT_LOCKED, 422 |
| GET `/projects/{id}/preview?revision=N` | 200 `{templateVersionId,revision,content,media,validation:{publishable,errors},rsvp:{formVersionId,fields}}` | 409 REVISION_CONFLICT; неполные поля — 200 с errors, не ложный publishable |
| POST `/projects/{id}/media` | Idempotency-Key; multipart `file` → 202 `{mediaId,state:"processing"}` после устойчивого приёма/постановки job | 413 FILE_TOO_LARGE, 415 UNSUPPORTED_IMAGE, 422 IMAGE_LIMIT, 409 CONTENT_LOCKED |
| GET `/projects/{id}/media/{mediaId}` | 200 `{mediaId,state,privatePreviewUrl?,failureCode?}` | 404 при несовпадении владельца/проекта |
| DELETE `/projects/{id}/media/{mediaId}` | Только до первой публикации; отсоединить и запланировать безопасную очистку → 204, повтор 204 | 409 CONTENT_LOCKED/MEDIA_IN_USE; не удалять asset, пока он выбран в черновике: сначала сохранить null |
| POST `/projects/{id}/publish` | Idempotency-Key; `{expectedRevision,tariffId,tariffVersion,slug}` → 201 receipt + currentState | 409/422, см. ниже |
| GET `/public/invitations/{publicId}` | 200 `{templateVersionId,content,media,metadata,rsvp:{formVersionId,fields}}` без ownerId/title/email/черновика | 404 INVITATION_UNAVAILABLE для всех причин недоступности; 503 при сбое |

PATCH сохраняет currentRevision+1 только при совпадении expectedRevision. При потере ответа клиент читает GET: если payload уже сохранён, не посылает слепое перезаписывание; иначе предлагает сверку. Replay-гарантия публикации ниже сильнее, чем семантика PATCH.

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
