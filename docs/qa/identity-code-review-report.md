# Code review identity: D-35

Продолжение ревью на `feat/web-sign-in`, 19.11.2026. Проверка исполнителем, не независимое ревью; принятие владельцем и merge не отмечены автоматически. Исходное ТЗ не менялось.

## Изменения по замечаниям

| Пункты | Результат |
| --- | --- |
| 1 | `userName` в register, pending/User, confirm/login/session, OpenAPI 0.6.0 и Orval. Nullable для старых аккаунтов; это имя обращения, не уникальный логин. Миграция 20261119020000_identity_user_name делает RENAME COLUMN, не DROP/ADD; прежняя миграция неизменна |
| 2, 5 | Алиасы FSD в tsconfig и Vitest; межслойные импорты через алиасы, внутри slice/сегмента относительные. Каждая переменная отдельным const/let. Правила в apps/web/AGENTS.md |
| 3 | `_app/query-client.ts`: новый экземпляр на серверный вызов, стабильный в браузере. Глобальная серверная константа запрещена; прежний lazy useState был корректным способом удержать экземпляр, заменён более явной фабрикой |
| 4 | Палитра и Mantine theme в `_app/identity-theme.ts`; provider только собирает контексты |
| 6, 8 | AccountPage/LoginPage — серверные оболочки. Запрос сессии, клиентские редиректы и logout остаются в отдельных client-компонентах; загрузка/ошибка/выход/обзор разнесены, длинных if/else больше нет |
| 7 | Общая request-конфигурация next-intl; страницы получают серверные переводы через getTranslations. Переводы не требуют client; менять библиотеку не нужно |
| 9–12 | Компоненты identity, шаги signup/reset разделены по файлам. Общий EmailInput; React Hook Form хранит значения/errors/touched, пароль/checklist/подтверждение имеют один источник состояния. Защита позднего результата и Retry-After остаются в useFormAction |
| 13 | API-клиент frontend перенесён в apps/web/src/shared/api. Browser entry и React-free server entry разделены; Orval остаётся кодогенерацией. packages/api-client и его workspace удалены, artifact builder больше не ожидает его manifest |

Внутреннее имя поля нового пароля reset-формы теперь `password`, API получает прежнее `newPassword`. Поле `passwordConfirmation` не отправляется ни при регистрации, ни при reset. Существующий пароль login не trim/не проверяется по правилам нового.

## Проверки

- Миграция применена локально к dev/test: восемь миграций, без reset и удаления пользовательских данных.
- `npm run test:web`: 57 проверок, включая 13 DOM-проверок форм/сессии на Vitest + Testing Library/jsdom. Остальные — валидация, trusted transport/CSRF, безопасная навигация, private cache, изоляция серверного QueryClient.
- `npm run test:database`: 55 реальных HTTP/PostgreSQL-проверок регистрации, кодов, reset и сессий. Первое выполнение нашло два устаревших ожидания порядка safe DTO keys после rename; ожидания исправлены, повтор успешен.
- Реальный Chrome + отдельный compiled API/test-БД/синтетический inbox: signup → код/resend → кабинет с именем → logout → reset → login; несовпадение паролей не вызывает POST, ошибки inline, native invalid events 0, legacy credentials, RU/EN, light/dark/reload/Tab/360 px, JavaScript errors 0. Скриншоты и отчёт игнорируются Git: `.verification/identity-code-review/`. Чужие серверы и аккаунты не остановлены и не удалены.
- `npm test`: 67 проверок (57 web и 10 artifact/startup); повторная генерация Orval идентична. `npm run typecheck` и `npm run build` обоих workspace успешны после восстановления зависимостей. Предыдущий запуск API упёрся в ограничение доступа к кешу Prisma; разрешённый повтор прошёл. `npm run format:web` проверяет также app/ и tests/, generated исключён.

Одна попытка `npm ci` в рабочей папке не прошла: Windows не смог удалить SWC, занятый запущенным Next.js. Зависимости восстановлены `npm install --ignore-scripts` без остановки чужого процесса; чистый `npm ci` по тем же manifests/lockfile успешно выполнен в `.verification/code-review-install`. Это проверка установки, не запуска приложений из этой временной папки.

## Пределы

DOM-тесты подменяют HTTP, а не доказывают работу backend — для этого отдельный PG-прогон и реальный browser. Полный cross-browser/a11y-аудит и production не выполнялись. Генерация клиента и artifact builder изменились; старые build-комплекты не доказывают готовность нового SHA. CI после push оценивается отдельно.

Изменения относятся к FR-02/FR-03 и NFR-01/NFR-06/NFR-07 из [ТЗ](../povod-mvp-spec-v0.1.md); код вместо исходной ссылки подтверждения принят D-30/32. Актуальные identity-правила — [authentication](../architecture/authentication.md), приёмка — [web identity](../operations/web-identity.md). Правила качества — [apps/web/AGENTS.md](../../apps/web/AGENTS.md).
