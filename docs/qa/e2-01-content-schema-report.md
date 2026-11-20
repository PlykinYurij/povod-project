# E2-01 · Проверки схемы контента

20.11.2026, feat/garden-content-schema от main f9882f3. [Карточка](../product/e2-01-content-schema.md), FR-06/07/09/11/12, NFR-07/08, D-36/37. Самопроверка ведущего; независимое ревью не выполнялось. Результат подготовлен к Review, не принят владельцем и не интегрирован автоматически.

## Выполнено

- `npm run typecheck`: оба workspace, включая API-тесты, успешно. Первоначальные ошибки unknown в JSON ответах новых тестов исправлены явным типом контракта; итоговая проверка прошла.
- `npm run build`: production Next и compiled Nest успешно; новых маршрутов web/API нет.
- `npm test`: 121 тест, 21 файл (111 web + 10 artifact/startup), успешно. Существующие renderer/i18n тесты уже проверяют copy/escaping/пустые строки/изолированный пресет; дублирующие тесты только ради нового типа не добавлены. Последующий web typecheck/format также успешны.
- `npm run test:database`: 113 тестов, шесть файлов. Из них 55 существующих identity на изолированной test PostgreSQL, девять catalog/OpenAPI, 49 новых garden runtime/HTTP. Garden HTTP использует отдельное тестовое Nest-приложение без БД, тот же ValidationPipe/ApiExceptionFilter; product write endpoint не добавлен.
- `npm run api:openapi`, `npm run api:generate`: схема 0.8.0 и клиент сгенерированы из настоящих compiled DTO, повторная генерация воспроизводима по digest всех generated-файлов.
- `npm run format:web` и targeted Prettier API: успешно после форматирования двух test-файлов.

## Что подтверждают новые проверки

Каждая согласованная длина, включая все 14 copy, проверена на границе и +1 с emoji. Программа 12/13, HTTPS URL 200/201, неверные типы без coercion, отсутствие required-nullable, null в массиве, unknown nested/root fields. Поля ошибок — dot paths без значений запроса; malformed JSON — 400.

Проверены неполный draft и требования полноты, пустая copy без подстановки, Unicode/HTML-подобный и ICU-подобный текст без преобразования, отсутствие изменения входа, календарная дата/високосный и невисокосный год, HH:mm, неверный/IANA пояс, прошедшая дата. Ссылка HTTPS без credentials/control/backslash; сервер по ней не обращается. UUID медиа только структурный, не гарантия ownership/ready.

OpenAPI отдельно проверен на реальные maxLength/maxItems/nullable/required и отсутствие write endpoints. Renderer принимает generated DTO readonly без второй ручной структуры.

Проверены __proto__/constructor: class-transformer обычно пропускает эти ключи до whitelist; общий pipe и валидатор явно возвращают UNKNOWN_FIELD, а не принимают запрос молча. Обычные поля/строки при этом не меняются.

## Ограничения

Не созданы draft persistence/revision/owner/quota операции, редактор, реальные загрузки, RSVP, публикация и production. HTTP fixture не доказывает их готовность; completeness не является publish guard. Проверки изоляции проектов/гонок относятся к следующим задачам. Новая миграция/зависимость/CI workflow не требовались. Известный риск next-intl/picomatch по D-33 не объявлен устранённым.

Дополнительный браузерный прогон старым локальным helper завис до запуска Chrome; остановлен вместе с собственным сервером, процессы владельца не затрагивались. Нового успешного browser/E2E результата нет. Новых экранов/стилей нет; компиляция, существующие SSR/component-тесты и реальные HTTP-тесты проверены отдельно. Прежние снимки дизайна не выданы за новые.
