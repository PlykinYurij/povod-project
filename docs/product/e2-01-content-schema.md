# E2-01 · Схема контента «Тихого сада»

20.11.2026: схема принята и проверена в main f220170 (PR #24, содержит 654f2f4). Первоначальная ветка feat/garden-content-schema от main f9882f3. Q-03 закрыт D-37. [QA](../qa/e2-01-content-schema-report.md) описывает проверки того этапа; последующий draft API — [E2-02](e2-02-private-drafts.md).

## Результат одного PR

Версионированная структура wedding-garden-v1: locale, copy, themeId, names, event, venue, program и heroMediaId; envelope templateVersionId/title/content. Все 14 текстов D-36 включены. DTO/runtime-validation принадлежат Nest; OpenAPI 0.8.0 ApiExtraModels → Orval → readonly renderer input. React/next-intl не импортируются backend. Новых HTTP endpoints, миграций, зависимостей и редактора нет. Каталог по-прежнему read-only.

validateGardenDraft проверяет целую структуру, допуская пустые поля и незавершённую программу. Это не partial JSON patch: будущий use case E2-02 отвечает за merge/revision/квоты/owner. validateGardenComplete требует заполненность контента, но не даёт разрешения publish: session/owner, слоты/срок, готовность/принадлежность фото и форма RSVP проверяются в следующих use cases. Прошедшая дата допустима, дата события не расходует период публикации.

## Принятые пределы D-37

| Значения | Максимум символов / элементов |
| --- | --- |
| Название проекта | 24 |
| Каждое имя события (не account userName) | 20 |
| Название места / адрес / HTTPS-маршрут | 80 / 150 / 200 |
| detailsTitle, programTitle, rsvpTitle | 160 каждый |
| invitationLabel, whenLabel, whereLabel, startTimeLabel, timeZoneLabel, routeLabel, programEyebrow, rsvpEyebrow | 80 каждый |
| namesConnector | 16 |
| introduction | 4000 |
| footerText | 1000 |
| Программа / текст одного пункта | 12 пунктов / 200 символов |

Счёт Unicode code points, не байты/UTF-16 units; составные emoji могут занимать несколько символов. Тексты хранятся без trim/автоперевода/HTML/ICU-интерпретации. Намеренно пустые copy не заменяются пресетом. Полнота требует непустые после проверки whitespace title, оба имени, дату/время/пояс, название и адрес места; включённая программа требует хотя бы один пункт с time/text. Содержимое при проверке whitespace не изменяется. Необязательные routeUrl/program/heroMediaId — явный null; routeUrl также допускает пустую строку как незаполненное поле, ссылка тогда не отображается.

## Критерии приёмки

- Неизвестные поля запрещены рекурсивно; типы не преобразуются. Поля nullable нельзя пропускать; nullable не равняется optional.
- Ошибки безопасны, 422 с dot paths; malformed JSON — 400. Не возвращать raw input/validator messages.
- Календарная дата, HH:mm, именованный IANA пояс; HTTPS без credentials/control characters/backslash. Без сетевого запроса по routeUrl.
- themeId sage/sand; immutable wedding-garden-v1. heroMediaId UUID/null не означает, что медиа существует или разрешено владельцу.
- Runtime-проверки и настоящий HTTP через тот же ValidationPipe/ApiExceptionFilter — в тестовом приложении, а не через новый production endpoint.
- Длины/Unicode/12 пунктов/пустые поля/полнота проверяются; OpenAPI и Orval воспроизводимы; renderer потребляет generated contract, tests colocated; types/build/format и регрессии.

Основание: FR-06/07/09/11/12, NFR-07/08, D-03/09/13/14/17/36/37; [ТЗ](../povod-mvp-spec-v0.1.md), [решения](decisions.md), [вопросы](open-questions.md), [traceability](../design/traceability.md). Q-04/08/16/19 не закрыты. Следующая задача после ревью — E2-02, создание и сохранение приватного черновика.
