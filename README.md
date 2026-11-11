# Повод

Сервис сайтов-приглашений. Сейчас реализован **E1-01: минимальный технический каркас** — одна Next.js-страница и NestJS liveness endpoint. Редактора, авторизации, БД и публикации приглашений пока нет.

## Требования и установка

Windows PowerShell, Node **26.13.0**, npm **11.20.0**. Версии зафиксированы в package.json / .node-version; несовместимая версия отклоняется npm через engine-strict. Docker, глобальный Nest CLI, pnpm и секреты этому этапу не нужны.

Из корня репозитория:

```powershell
node --version
npm --version
npm ci
```

Установка одна для обоих workspace, используется корневой package-lock.json. Не выполнять отдельный install и не создавать lockfile внутри apps.

## Локальный запуск

В первом терминале из корня:

```powershell
npm run dev:web
```

Открыть [http://127.0.0.1:3000](http://127.0.0.1:3000): заголовок «Повод» и сообщение, что создание приглашений пока недоступно.

Во втором терминале из корня:

```powershell
npm run dev:api
```

В третьем терминале:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
```

Ожидаются HTTP 200, application/json и `{"status":"ok"}` (PowerShell выводит разобранный объект). Это проверка процесса, не готовности БД или продукта. Web пока не запрашивает API. Оба сервиса слушают только 127.0.0.1.

Остановка — Ctrl+C в каждом терминале; если cmd спрашивает о завершении пакетного файла, подтвердить. Затем те же команды запускают приложения повторно. Не завершать все процессы node на компьютере. При занятом порте найти свой прежний процесс или выбрать другой порт; не считать ошибку запуска успехом. API dev-watch после ошибки продолжает ждать изменений, тогда как production start завершится с ненулевым кодом.

API поддерживает `PORT` (целое 1..65535). В PowerShell для другого порта: `$env:PORT = '3101'`, затем `npm run dev:api`; после остановки — `Remove-Item Env:PORT`. Другой web-порт передаётся прямо workspace-команде: `npm run dev --workspace=@povod/web -- --port 3100`.

## Проверка и production-сборка локально

```powershell
npm run typecheck
npm run build
```

Обе команды проверяют оба workspace. Web typecheck сначала выполняет `next typegen`, поэтому работает и до первого build/dev. `.next`, dist, next-env.d.ts и tsbuildinfo — генерируемые файлы, в Git не входят. Автодополнение AGENTS со стороны Next отключено в next.config.ts: инструкции поддерживает команда.

После build можно в двух терминалах выполнить:

```powershell
npm run start:web
```

```powershell
npm run start:api
```

Используются те же порты; сначала остановить dev. В production-командах нет watch. API build — TypeScript, dev — встроенный Node watch + ts-node, сохраняющий decorators metadata; отдельный Nest CLI не требуется. Это локальная проверка сборки, не настроенный production-деплой. Сборка API пока не очищает старые dist-файлы: для воспроизводимой приёмки использована чистая копия; выпуск неизменяемого артефакта отдельно E1-07.

Отдельные команды из `apps/web` или `apps/api`: `npm run dev`, `npm run typecheck`, `npm run build`, `npm run start`. Устанавливать зависимости всё равно из корня. Корневой `npm test` запускает Vitest-тесты целостности build-комплекта; тестов бизнес-функций/E2E/lint/format scripts пока нет, они вводятся по реальному объёму.

Для чистой зафиксированной ветки добавлен `npm run artifact:create`: собирает отдельный runtime-комплект по SHA и проверяет его вне исходного checkout. Проверка скачанного комплекта: `npm run artifact:verify -- <каталог> <SHA> <доверенный-manifest-SHA256>`; preview требует `--allow-preview`. [Инструкция и ограничения платформы](docs/operations/artifacts.md), [фактические результаты](docs/qa/e1-07-report.md). Это не деплой и не сборка каждого приглашения.

## Документы и приёмка

[CI](.github/workflows/ci.yml) проверяет установку, типы и сборки на Windows/Linux для push и PR. [Описание и обязательность проверок main](docs/operations/ci.md), [отчёт E1-02](docs/qa/e1-02-report.md). Деплой этим workflow не выполняется.

- [Отчёт проверок E1-01](docs/qa/e1-01-report.md), [карточка](docs/product/first-task.md), [версии E1-00](docs/operations/toolchain.md).
- [Контракт технического этапа](docs/architecture/skeleton-contract.md), [backlog](docs/product/backlog.md), [статус](docs/preparation-status.md).
- [Макет первого продуктового сценария](docs/design/first-flow.html): открыть локальный файл в браузере. Это автономная демонстрация без настоящего API и сохранения.
- [Продуктовая карта](docs/product/README.md), [архитектура](docs/architecture/README.md), [правила агентам](AGENTS.md).

Для приёмки повторить установку/два dev-запуска, открыть web и health, выполнить typecheck/build. Для макета пройти шаблон → редактор → предпросмотр → публикация со свободным адресом → гостевая → RSVP; ошибки переключаются демонстрационными контролами. Макет не является реализацией этого сценария в apps/web.
