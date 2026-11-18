# Первая web identity-часть · итоговые проверки

Итог: pin next-intl 4.15.1 разрешён D-33, проверки успешны, результат Review. Ранние разделы ниже описывают историю исследования; текущий итог — в конце.

Ветка `feat/web-sign-in`, база `d19e115`, Windows/Node 26.13.0/npm 11.20.0. Самопроверка ведущим, не независимый security review. [Карточка](../product/e1-04b-web.md).

Сделано: `/login`/`/account`, Orval client/plain methods, локальный provider scope, RU/EN/theme, state/error mapping/cache cleanup. Устранён дублированный X-CSRF-Token в Swagger register (обнаружен валидатором Orval), snapshot регенерирован; runtime guard не удалён. CORS дополнен exposed Retry-After для browser fetch; logout без полей отправляет JSON `{}`, как требует backend.

Успешные проверки текущего checkout: typecheck всех трёх workspaces; build web/API/client; root unit 13 (8 artifact и 5 transport/cache), отдельно test:web 5; backend regression 52/52. Первоначально root Vitest include не включал web, он расширен адресно — 13, а не 8, реально запущены после исправления. Отдельно устранён недостающий dom.iterable в TS config клиента, hooks сгенерированы для TanStack v5.

Browser Chrome/CDP: настоящий production web build с local API/PG, два синтетических владельца. Проверены anonymous `/account`→`/login`, wrong password 401, valid login 200, logout, повтор anonymous guard, A→logout→B без email A, RU→EN и light→dark с сохранением UI prefs при reload, 360 px без overflow и Tab email→password. Негативные UI ответы 422/429/503 смоделированы CDP только для POST login, включая Retry-After=2 и блокировку кнопки на период. Это отдельно от реального server regression, не доказательство реальных 503 на сервере. Ошибок JS не было. Просмотрены снимки mobile EN/dark и account desktop RU/light.

Синтетические users и их Session/login limiter fixtures удалены, свои процессы остановлены. Коды/пароли/cookie не выводились. Удачный browser прогон выполнен с исследовательской next-intl 4.5.8 до последующих стилевых/структурных уточнений. Эти результаты не выдаются за финальную приёмку 4.15.1 или итогового дерева.

## История выбора pin / автоматическая проверка разрешений

Изначально проверены совместимые версии: Mantine core/hooks 9.8.1, TanStack Query 5.108.0, next-intl 4.15.1, Orval 8.48.0; Prettier 3.10.1. Next-intl 4.15.1 добавляет watcher/picomatch: production dependency audit два high entries той же GHSA-fc5q-39xc-vjpf. Actual artifact reachability ещё не проверена. Full dev graph с Orval — 21 high entries, не 21 независимая advisory.

Исследован pin next-intl 4.5.8 без watcher, но production audit выявил [open redirect](https://github.com/advisories/GHSA-8f24-v5vv-gm5j) и [prototype pollution precompile](https://github.com/advisories/GHSA-4c35-wcg5-mm9h). Это не решение для итогового PR. Первичные advisory проверены 18.11.2026; текущий код не включает middleware as-needed или experimental.messages.precompile, но их неиспользование не исправляет уязвимую версию.

Возврат на 4.15.1 отклонён автоматической проверкой разрешений как внесение известной уязвимой production-зависимости без отдельного owner acceptance. Пользователю отправлен запрос разрешить только local development/проверки, без production release. До ответа зависимая установка/окончательная проверка/commit/push не выполняются. Чистый audit не заявляется; E1-02b остаётся связанным вопросом.

Проверки final-pin/browser/clean install/kit/CI завершены позднее, см. итог. Не выполнены: полная доступность/screen-reader/физические устройства, production proxy/TLS и новые registration/reset формы. Тестовые результаты не означают security exception или готовность к публичному выпуску.

Заключительный независимый checkpoint до ответа по зависимости: после выделения sign-out feature, shared CSS tokens и согласования контрастной палитры повторены typecheck, 13 unit, format:web, web build и весь browser сценарий — успешно на том же interim 4.5.8. CORS expose Retry-After подтверждён дополнительным assertion в реальном HTTP suite, 52/52. Generated client повторно создан Orval и побайтный digest совпал. Проверены diff, 172 локальные Markdown-ссылки, неизменность исходного ТЗ и отсутствие локальных credentials в изменениях. Все изменения сохранены в рабочей папке ветки, индекс/commit/push не использовались; финальный pin по-прежнему ждёт решения.

## Финализация после разрешения D-33

Владелец явно разрешил next-intl 4.15.1 с известным риском picomatch для local development/checks/commit/push, без production release. Установка выполнена, блокер снят; 4.5.8 удалена из финального pin. Ниже фиксируются только реально повторённые результаты итогового дерева. Ранние параграфы — история исследования, не текущий блокер.

На явно разрешённой next-intl 4.15.1 повторно успешны typecheck/build трёх workspaces, format:web, 13 unit, 52 реальных backend HTTP/DB и полный Chrome сценарий (login/logout/A-B/360/RU-EN/theme/focus; 422/429/503 — управляемые UI fixtures). Generated client воспроизведён без изменений. Текущий полный npm audit вернул 0 findings; это результат текущего audit feed, не доказательство исправления ранее известной advisory и не разрешение production. Проверены 178 локальных Markdown-путей, diff, неизменность ТЗ и отсутствие локальных credentials.

## Проверка опубликованного кода 70da260d2c62bbca0eed4611d0635a94df05f6ce

[CI 44366261060](https://github.com/PlykinYurij/povod-project/actions/runs/44366261060) — четыре jobs success: Windows, Linux, Database integration и Linux build kit. Включены web unit tests и проверка воспроизводимой Orval generation.

Windows preview kit создан из git archive точного SHA: clean npm ci, typecheck/build всех трёх workspaces, runtime вне репозитория, native imports. Web/health/staticAsset — 200. Manifest SHA-256 dbb543c74bce7ab6e544e2a3357ccf06a2b740113d71b6228517f3fb434dff87; artifact:verify с ожидаемыми SHA/digest и --allow-preview — verified true. Локальный ignored-каталог artifacts/70da260d2c62bbca0eed4611d0635a94df05f6ce-win32-x64-local-792b9836-fd19-4709-9f5c-6fd809cddb58-1.

Дополнительно web.tar.gz распакован в новый временный каталог вне репозитория; /login — 200 с email/password полями, без установки на runtime. Traced файлов с путём @parcel/watcher не обнаружено (0); это ограниченная проверка файлов, не доказательство устранения advisory/полный security audit. Собственный runtime остановлен, временный каталог удалён.

Последующий коммит — только документация/статусы. Kit и CI выше относятся к точному коду 70da260d2c62bbca0eed4611d0635a94df05f6ce, а не автоматически к новому SHA документов. Owner acceptance/main и production release не отмечены.
