# V2-02 · Общая заявка без аккаунта

21.11.2026, feat/public-service-requests, база main 3626e47 + E2-01d 195f26c. Самопроверка ведущего, не независимый QA. [Карточка](../product/v2-02-public-service-request.md), [local](../operations/service-requests.md).

- npm run typecheck: оба workspace, включая colocated API-тесты, успешно.
- npm run build: web/API успешно, без production release.
- npm test: 150 проверок / 25 файлов (140 web, 10 artifact/startup), семь новых transport/receipt проверок.
- npm run test:database: 198 / 10 файлов (35 новых service-request, 163 регрессии), ноль ошибок workers в финальном прогоне.
- Dev/test двенадцатая аддитивная миграция: без reset, повтор deploy без pending. Содержимое существующих User/Project не изменялось миграцией.
- OpenAPI 0.12.0 → Orval; повторное generated дерево воспроизводимо. Format web и изменённых API TS/MTS успешен.

Проверено: anonymous submit без User/Project; все каналы/нормализация/Unicode; 16 invalid/server-owned случаев; отсутствующий/неверный key/query; Origin/JSON/malformed/oversize; minimal receipt/no-store/без Set-Cookie; replay/uppercase/новое тело/неизменный receipt после закрытия; два реальных API экземпляра; phone cap в гонке/expiry/Retry-After; IP cap с поддельным XFF/expiry; rollback после записи rate; valid session игнорируется; нет public GET/details/PII/URL; expired rate cleanup сохраняет live counters; secret validation/production отсутствие секрета fail-closed при живом health; OpenAPI без cookie security.

Первые два прогона нашли стартовую зависимость: новый rate-secret требовался конструктором даже для чужих auth/liveness сценариев в production-режиме. Nest default abort прерывал два старых worker. Исправлено без ослабления проверки: secret проверяется лениво при новом submit, без него 503/no insert; createApplication использует abortOnError=false, чтобы конфигурационная ошибка оставалась обрабатываемым исключением и работал безопасный startup reporter. Добавлен отдельный тест этого отказа; финальный полный прогон 198/198. Старые private CSRF/owner/registration/reset проверки сохранены.

Данные/nonce fixtures синтетические только povod_test; новый набор удаляет свои requests/rate keys/users по созданным ключам/UUID. Никаких обращений к клиентам, мессенджерам или SMS; новые поля не являются автоматической верификацией телефона/профиля. Checkbox фиксирует технический consent, не подтверждает юридическую готовность.

Форма UI, operator queue/status mutations, заказ с проектом, создание/публикация admin, медиа/RSVP, реальная цена, нагрузка/browser E2E и публичный выпуск не входят/не проверялись. Новых dependencies/workflow нет, исходное ТЗ сохранено.
