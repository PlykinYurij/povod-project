# Сверка UX / API / данных / критериев

Основание: [критерии FR/NFR](../product/acceptance-criteria.md), [контракт](../architecture/api-contract.md), [HTML](first-flow.html). Ведущий сопоставил два предложения после получения обоих результатов. Схема v1 ниже едина для макетов и API; display-ключи HTML адаптируются к путям content при будущей реализации, а не используются как ORM-модель.

| Экран/поле | API / данные | Требование и проверяемый результат |
| --- | --- | --- |
| Выбор «Тихий сад» | templateVersionId → Project.templateVersionId → snapshot.templateVersionId | FR-01/05, D-09: версия выбрана один раз, не меняется |
| Название проекта | title → Project.title, owner-only | Предложение A-01; не попадает в публичный DTO/заголовок приглашения автоматически |
| Имена | content.names.first/second → Draft JSON → Snapshot JSON | FR-06/11, D-03: заполнены перед публикацией |
| Дата, время, пояс | content.event.localDate/localTime/timeZone → JSON | FR-06, D-13: формат корректен, дата не управляет сроком |
| Название места, адрес | content.venue.name/address → JSON | D-03/14: оба обязательны, принято владельцем |
| Маршрут | content.venue.routeUrl → JSON | FR-06, NFR-08: опциональный HTTPS URL, без скриптов |
| Палитра | content.themeId → TemplateVersion.themes → JSON | FR-07: только sage/sand, без произвольных цветов/кода |
| Фото включено / выключено | content.heroMediaId или null → MediaAsset / PublicationMedia | FR-10/11: неготовое или чужое фото не публикуется; производная версия фиксируется |
| Программа | content.program = null либо [{time,text}] → JSON | FR-06: фиксированное место блока; опциональность до публикации |
| Статус сохранения | expectedRevision/revision → ProjectDraft.revision | FR-08: старая ревизия не затирает новую, ошибка видима |
| Приватный preview | revision + DTO → общий рендерер | FR-09: only owner, no-store, неполные поля с ошибками готовности |
| Тариф/подтверждение | offer.id/version/durationSeconds → Grant | FR-11, D-19: 90 дней расхода с commit; дата события не участвует |
| Успех/общая ссылка | receipt.publicUrl/publicationId + currentState → Project.publicId, Snapshot, Grant | FR-11/13/14: повтор даёт тот же результат, не новый период; clipboard-ошибка не успех |
| Ограничения после выпуска | canEditDraft=false, canCorrectTexts=true | D-17: только отдельная текстовая коррекция, остальные прямые правки запрещены |
| Гостевая | publicId → безопасный DTO, content и media, rsvp:{formVersionId,fields} | FR-13: нет ownerId/title/email/приватных ключей; неактивная выдача не раскрывает контент |
| Пауза/место | visibility, remainingSeconds/runningSince, slotOccupied | FR-20, D-05/07/08/11: два режима admin, владелец сам resume, пауза удерживает место |
| RSVP первой версии | TemplateVersion v1 + FormVersion + Response | D-16: форма с первой публикации; 300 атомарно; после истечения soft-delete D-20 |

## Несостыковки предложений и их разрешение

1. UX добавил палитру по FR-07, в стартовой схеме архитектора её не было. Введён content.themeId и две фиксированные палитры, одинаковые в UI и контракте.
2. Неопределённость preview неполных полей: сохраняем partial draft, endpoint возвращает publishable/errors, а не делает неполный черновик непредпросматриваемым. Publish проверяет полную схему. Макет позволяет прямо открыть preview через панель ревью; это не обход API.
3. Владелец отклонил R-01 решением D-16: форма включена уже в v1, фиксируется при первой публикации.
4. D-17 уточняет FR-12: отдельный endpoint исправляет только тексты с новой immutable-версией; структура, фото, даты, шаблон и анкета не меняются. Точный whitelist остаётся Q-16.
5. Срок 90 дней принят, даты примера синтетические; контракт получает длительность offers и возвращает серверный receipt/currentState. «Сохранить черновик», «опубликовать впервые» и «возобновить» — разные операции.
6. Правило no-store упрощает новый HTML-отзыв, но **не** объявляет решённым TTL ранее выданных фото/скачанных копий.

## Будущие проверки реализации

Контрактное соответствие полей и field-error paths; две вкладки/гонка save-publish; успешный upload с failed job; третье занятое место; таймаут после commit и replay; запрет редактирования прямым запросом; чужие ресурсы; no-store/private preview; истечение без cron; mobile 360 px/клавиатура/reduced-motion. Это критерии для следующих задач, не отчёт их прохождения на приложении.

## Сверка после ревью D-14–18

R-01 заменено D-16: форма в v1. FR-12 покрывает whitelist-коррекцию с новой immutable-версией и прежними grant/publicId/formVersion. По D-20 при истечении слот свободен, контент/фото/ответы эффективно удалены, независимо от cron.

D-19–21 заменяют прежние формулировки по сроку/ответам: offers.durationSeconds=7776000, при remaining=0 слот свободен, invitation/media/responses эффективно soft-deleted; поздняя purge-задача не определяет доступность. FormVersion каталога и код шаблона не удаляются. Предупреждение в confirm связано с политикой API; restore/purge delay — Q-19.
