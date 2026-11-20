# Приватные черновики · E2-02

Контракт: [карточка](../product/e2-02-private-drafts.md), [QA](../qa/e2-02-private-drafts-report.md). Серверная часть есть; кабинет создания/редактор — следующая задача.

## Запуск и автоматическая приёмка

PowerShell из корня. Docker Desktop и локальный PostgreSQL должны быть запущены; [первичная настройка](local-postgres.md) уже выполнялась. Зависимости — существующие npm workspaces, нового install не требуется.

```powershell
npm run build --workspace=@povod/api
npm run db:migrate:dev
npm run db:migrate:test
npm run test:database
npm run typecheck
npm test
```

Запуск двух приложений в отдельных терминалах:

```powershell
npm run dev:api:database
```

```powershell
npm run dev:web
```

Если прежние серверы уже работают, не запускать второй процесс на том же порте; API watch увидит исходники. API без DATABASE_URL возвращает 503 для приватных проектов; helper выше подключает локальную dev-БД. HTTP API — 127.0.0.1:3001, PostgreSQL — SQL на 15432.

Тесты создают случайные синтетические User/Session/Project только в проверенной test-БД и удаляют только свои user ID с зависимостями. Dev-проекты/учётные записи не очищаются. Миграция аддитивна, reset/schema push не используются. Пресет нового проекта принадлежит templates-модулю; web-демо остаётся синтетическим примером и не источник сохранённых проектов.

## Ручное ревью API

OpenAPI: http://127.0.0.1:3001/api/docs, группа projects, схемы CreateProjectDto/SaveProjectDraftDto/ProjectDto. Swagger открыт с API origin, а mutation guard требует WEB_ORIGIN: Try it out для мутаций оттуда не обходит CSRF/origin. Для проверки использовать авторизованную страницу http://127.0.0.1:3000/account и DevTools либо автоматические HTTP-тесты выше.

Необязательный пример в Console на странице web после входа создаёт **один синтетический проект в dev** и занимает место из пяти черновиков. Удаление через API/кабинет ещё не реализовано. Автоматические тесты предпочтительнее, если не нужно оставлять dev-запись. Секреты/session cookie не копируются и не выводятся; CSRF остаётся внутри функции:

```js
void (async () => {
  const api = "http://127.0.0.1:3001";
  const bootstrap = await fetch(`${api}/api/v1/auth/csrf`, { credentials: "include" });
  if (!bootstrap.ok) throw new Error(`CSRF bootstrap: ${bootstrap.status}`);
  const { csrfToken } = await bootstrap.json();
  const headers = { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() };
  const body = JSON.stringify({ templateVersionId: "wedding-garden-v1", title: "Ревью черновика" });
  const created = await fetch(`${api}/api/v1/projects`, { method: "POST", credentials: "include", headers, body });
  if (created.status !== 201) throw new Error(`Create: ${created.status}`);
  const project = await created.json();
  const replay = await fetch(`${api}/api/v1/projects`, { method: "POST", credentials: "include", headers, body });
  project.content.copy.introduction = "Наш новый текст";
  const saved = await fetch(`${api}/api/v1/projects/${project.id}/draft`, {
    method: "PATCH", credentials: "include", headers,
    body: JSON.stringify({ expectedRevision: project.revision, title: project.title, content: project.content })
  });
  if (!saved.ok) throw new Error(`Save: ${saved.status}`);
  const next = await saved.json();
  console.info({ id: project.id, create: created.status, replay: replay.status, save: saved.status, revision: next.revision });
})();
```

Ожидается 201/200/200/revision=2. Код примера отдельно в браузере не запускался; те же запросы и последствия проверены реальными HTTP/PG-тестами. В Network можно прочитать ответ GET /api/v1/projects/{id}; 409 при старой revision требует чтения/сверки, не слепого retry. Фото/публикация и авторедирект в новый редактор здесь не добавлены.

Ключ создания хранится с проектом без автоматического TTL. Q-11/19 нужно закрыть перед purge/повторной выдачей ключей. До этого не добавлять очистку receipt, которая может создать дубликат после потерянного ответа. Список исключает deletedAt; опубликованные записи не занимают draft-квоту и не разрешают save.
