# Web вход и кабинет · рабочая ветка

Владелец явно разрешил next-intl 4.15.1 с известным риском picomatch для local development/проверок и commit/push (D-33). Production release не разрешён. Исследовательская next-intl 4.5.8 больше не используется.

[Карточка](../product/e1-04b-web.md), [QA](../qa/e1-04b-web-report.md), [макеты](../design/identity-flow.md).

Локальный запуск из корня при работающем локальном PostgreSQL:

```powershell
npm ci
npm run db:migrate:dev
npm run dev:api:database
```

Во втором терминале:

```powershell
npm run dev:web
```

Если watch пишет `Failed running 'src/main.ts'`, смотрите предшествующую диагностику. `port is already in use` означает, что прежний API всё ещё занимает 3001: остановить его в исходном терминале через Ctrl+C, затем запустить helper. Не запускать одновременно `dev:api` и `dev:api:database` на одном порту. Не завершать все процессы node на компьютере. `/health` проверяет процесс, но не наличие DATABASE_URL.

Открыть `http://127.0.0.1:3000/login`. API — 3001, WEB_ORIGIN по умолчанию `http://127.0.0.1:3000`, cookies host-only на 127.0.0.1. Не смешивать localhost/127.0.0.1: это разные cookie hosts и Origins. PostgreSQL 15432 не HTTP.

На главной есть кнопка «Перейти в личный кабинет» (RU/EN). Авторизованного посетителя `/login` перенаправляет в `/account`, не показывая форму повторного входа. Гость с `/account` попадает на `/login?returnTo=…`; после входа сохраняются исходные query/fragment. Адрес возврата проверяется по allowlist существующих private routes: сейчас только `/account`, внешние URL и `/login` отклоняются. Выход всегда направляет непосредственно на `/login`. Ошибка проверки сессии (503/сеть) отличается от 401: UI предлагает повтор проверки, не объявляет пользователя гостем без подтверждения.

UI регистрации ещё нет: создать свой синтетический аккаунт и подтвердить email по [backend-инструкции](registration-confirmation.md), затем использовать этот email/password в форме. Истинные credentials/письма не печатать в отчёте и не добавлять в Git. Тестовые браузерные fixtures создавались отдельно и после проверки удалены; готового общего тестового пароля репозиторий не содержит.

Приёмка:

1. Без входа `/account` показывает проверку сеанса и возвращает на `/login`, без email/private данных в HTML или скрытых карточках.
2. Неверный пароль/неизвестный email — одно сообщение. Корректные credentials → `/account` с текущим email и честной заглушкой будущих приглашений, без fake project API.
3. RU/EN и тема переключаются; язык хранится как несекретная cookie, тема — стандартная UI-настройка Mantine. Локализация пока только identity; главная — прежний технический placeholder.
4. Logout → `/login`; повторное открытие `/account` не восстанавливает private содержимое. После login другого владельца виден только его email. При неясном logout статусе private область скрывается, предлагается повтор, «успех» не показывается.
5. API не работает → понятная ошибка, без бесконечного автоматического retry login. 429 использует Retry-After; countdown не запрашивает authenticated API и не продлевает idle Session.

Проверки: `npm run api:openapi` (после API build), `npm run api:generate`, `npm run typecheck`, `npm test` (13 source tests), `npm run test:web` (5 focused tests), `npm run format:web`, `npm run build`, `npm run test:database` (после test migrations). Generated output должен воспроизводиться без diff. Browser checks/isolated kit выполнять для фактического итогового дерева, не переносить успех между pins.

Direct browser API через credentials+CORS, без нового proxy/BFF. NEXT_PUBLIC_API_ORIGIN — доверенный публичный origin, задаётся до web build; по умолчанию 127.0.0.1:3001. API должен разрешать точный WEB_ORIGIN и expose Retry-After. Server entry клиента пока только экспорт plain methods: cookie/CSRF forwarding SSR не реализованы и не выдаются за готовый SSR guard. Private data проверяет NestJS, client guard отвечает только за отображение.

Формы signup/code/reset, admin, проектный список/квоты/CRUD, production TLS/proxy/почта и деплой — отдельные задачи. ESLint пока не настроен; форматирование — стандартный Prettier, типы — strict TS, поведение — Vitest и browser/API проверки.
