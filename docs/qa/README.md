# Проверка качества

[Матрица критичных проверок](test-plan.md) разделяет каркас T, продукт P и RSVP R. Каркас проверен: [T-01–06](e1-01-report.md); [CI E1-02](e1-02-report.md) имеет положительный и негативный hosted-прогоны. Продуктовые P/R остаются Planned, unit/E2E scripts пока нет. Основание: [критерии](../product/acceptance-criteria.md). Выпускные доказательства — [операции](../operations/release-plan.md).

[E1-04c: backend восстановления по коду](e1-04c-report.md) — HTTP/PostgreSQL/local inbox, без проверки web/SMTP/production.

[E1-02b: оценка audit dev-зависимостей](e1-02b-report.md) — варианты для owner review, уязвимость не объявлена исправленной.

[E1-04d: backend регистрации с email-кодом](e1-04d-report.md), без проверки UI/SMTP/production.

[Web signup/code/reset](e1-04-identity-web-report.md) — реальный browser/API/test-БД/inbox и отдельно UI fixtures; передано на Review.
