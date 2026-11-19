# API frontend

Этот код принадлежит web. Backend владеет DTO, валидацией и снимком [OpenAPI](../../../../api/openapi.json); общих ORM-моделей здесь нет. Отдельный npm-пакет удалён по ревью D-35: второго потребителя пока нет.

- `generated/models`, `generated/http.ts`, `generated/query.ts` создаёт Orval из `apps/api/openapi.json`; вручную не редактировать и не форматировать.
- `index.ts` — браузерные hooks/types, импорт `@shared/api`.
- `server.ts` — plain methods/types без hooks, импорт `@shared/api/server` для серверного чтения. Cookie передавать только доверенному API и в рамках текущего запроса; mutation требует явного CSRF-контекста.
- `transport.ts` — trusted origin/path, credentials, CSRF, runtime-проверка критичных ответов, HTTP errors. Значение `NEXT_PUBLIC_API_ORIGIN` определяется при сборке.
- `identity-errors.ts`, `private-cache.ts` — общая обработка ошибок и очистка приватного cache.

Команды из корня: `npm run build --workspace=@povod/api`, `npm run api:openapi`, `npm run api:generate`, затем `npm run typecheck` и `npm run test:web`. При повторной генерации diff должен быть пустым. Backend не импортирует frontend-клиент.
