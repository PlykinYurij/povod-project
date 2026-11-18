# API client

- Действуют корневые инструкции. Swagger NestJS `apps/api/openapi.json` — источник контракта; `npm run api:generate` из корня создаёт `src/generated/**`. Generated-файлы не редактировать руками.
- `src/index.ts` — client hooks/типы; `src/server.ts` — только plain methods/типы без React hooks. Не импортировать client entry в RSC/server-only код.
- Общий transport не хранит owner-session; browser CSRF promise существует только до завершения bootstrap. В server requests Cookie/CSRF передаются явно из конкретного запроса, никогда из global store.
- Только доверенный NEXT_PUBLIC_API_ORIGIN и фиксированные generated paths получают credentials. Не принимать origin/redirect из пользовательского payload. No-store для auth, без слепых повторов POST.
- Типы/проверки: root `npm run typecheck`, `npm test`, `npm run api:generate`; diff generation должен воспроизводиться. Изменение ошибок/полей сначала в реальном backend, затем export OpenAPI и генерация.
