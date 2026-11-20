# Проверка качества

[План MVP v2](mvp-v2-test-plan.md): заявки/контакты/admin permissions, согласованная цена/revision, admin-assisted project, две административные сессии и миграция. Старые отчёты ниже доказывают только соответствующие исторические реализации; новых успешных admin/request тестов пока нет.

[E2-02: приватные черновики](e2-02-private-drafts-report.md) — реальные HTTP/PG, owner/CSRF, quota/race, create replay, revision/conflict/rollback; UI редактора ещё нет. Схема E2-01 принята в main f220170.

[E2-01b: read-only каталог](e2-01b-catalog-report.md) — реальные API/Orval/SSR, локализованные metadata, HTTP без БД и симуляции empty/error/loading отдельно. E2-01a/D-36 принят в main de0cae2.

[E2-01a: первый рендерер «Тихий сад»](e2-01a-report.md) — SSR/палитры/пустые данные/медиа/360 px; demo без API/публикации. Identity принят в main eb9bc34 по сообщению владельца.

[Матрица критичных проверок](test-plan.md) разделяет каркас T, продукт P и RSVP R. Каркас проверен: [T-01–06](e1-01-report.md); [CI E1-02](e1-02-report.md) имеет положительный и негативный hosted-прогоны. Основная продуктовая вертикаль P/R ещё не завершена; identity имеет отдельные отчёты ниже. Unit/component scripts уже есть, постоянного browser E2E script пока нет. Основание: [критерии](../product/acceptance-criteria.md). Выпускные доказательства — [операции](../operations/release-plan.md).

[E1-04c: backend восстановления по коду](e1-04c-report.md) — HTTP/PostgreSQL/local inbox, без проверки web/SMTP/production.

[E1-02b: оценка audit dev-зависимостей](e1-02b-report.md) — варианты для owner review, уязвимость не объявлена исправленной.

[E1-04d: backend регистрации с email-кодом](e1-04d-report.md), без проверки UI/SMTP/production.

[Web signup/code/reset](e1-04-identity-web-report.md) — реальный browser/API/test-БД/inbox и отдельно UI fixtures; передано на Review.

[D-34: review форм, имя и пароль](identity-review-report.md) — новая миграция, контракт 0.5.0, inline ошибки/подтверждение/живые правила/переключатели.

[D-35: code review frontend](identity-code-review-report.md) — userName/контракт 0.6.0, FSD-алиасы, React Hook Form, серверные переводы, API-клиент в shared/api и DOM-тесты.

- [Проверки серверных admin-прав E2-02d](e2-02d-admin-access-report.md): 147 HTTP/PG регрессий и 129 root, реальные local CLI прогоны на синтетических аккаунтах.

- [Проверки каталога E2-01d](e2-01d-catalog-data-report.md): 163 HTTP/PG, 143 root, реальный SSR smoke без пользовательских серверов.
