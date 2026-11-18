# @povod/api-client

Orval client из `apps/api/openapi.json`: `npm run api:generate` из корня. TS workspace потребляется Next.js через transpilePackages; отдельный публичный npm package не выпускается.

- `@povod/api-client`: методы, TanStack Query v5 hooks и DTO.
- `@povod/api-client/server`: plain methods и DTO без hooks; само по себе не выполняет аутентификацию RSC.
- `transport.ts`: безопасные ошибки, credentials/no-store и CSRF перед browser POST. Тело `{}` для auth POST без полей, JSON Content-Type для OriginGuard. Server POST требует явный CSRF конкретного запроса. Session токены не передаются в JSON или localStorage.
- API origin — точный доверенный `NEXT_PUBLIC_API_ORIGIN`, default `http://127.0.0.1:3001`. Это публичная настройка, не секрет. Указать до Next build; при изменении адреса нужна новая web-сборка. Перенос server-only origin/SSR-fetch в отдельный adapter — когда появится SSR-потребитель.

Generated methods не редактируются. Есть два output: fetch и react-query; одинаковые models. `server` не импортирует query output. Backend пока покрывает identity/health; публикация, media и RSVP не выдумываются в клиенте. Logout/session ошибки не означают автоматический успех или разрешение доступа — UI сверяет status с backend.
