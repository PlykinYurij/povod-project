# E1-00 · Версии каркаса

Проверено 11 ноября 2026 в Windows PowerShell, Node `26.13.0`, npm `11.20.0`. Установка инструментов в систему не выполнялась. Зависимости устанавливаются локально в workspace, глобальный Next/Nest CLI не нужен.

| Пакеты | Точный pin | Проверенное ограничение |
| --- | --- | --- |
| next | 16.4.6 | Node >=20.9; peer React/React DOM допускает ^19.0.0 |
| react, react-dom | 19.3.1 | React DOM требует React ^19.3.1 |
| @nestjs/common, core, platform-express | 11.2.9 | Core требует Node >=20, пакеты Nest ^11, rxjs ^7.1, reflect-metadata ^0.1.12 или ^0.2 |
| ts-node | 10.9.2 | Peer TypeScript >=2.7, @types/node *; фактический запуск на Node 26 проверяется по отчёту |
| typescript | 5.9.3 | Единая версия компилятора в корне |
| @types/node | 26.6.6 | Типы линии Node 26 |
| @types/react, @types/react-dom | 19.3.0 | Типы линии React 19 |
| reflect-metadata | 0.2.2 | Допускается peer Nest |
| rxjs | 7.8.2 | Допускается peer Nest |

Источник точных pins/engines/peers — публичные metadata npm registry, полученные через `npm view <package>@<version> ... --json`. Выбраны последние доступные patch согласованных линий, без перехода на новый major Nest/TypeScript. [Next installation](https://nextjs.org/docs/app/getting-started/installation) и [Nest versions](https://docs.nestjs.com/faq/versions) сверены 11 ноября; метаданные именно установленной версии важнее страницы про другой major.

Эта сверка снимает B-02 выбора версий; фактическая установка, типы, сборки и запуск фиксируются отдельно в [отчёте E1-01](../qa/e1-01-report.md). Отсутствие peer-конфликта не является доказательством отсутствия уязвимостей или готовности production.

Первоначально проверен локальный Nest CLI 11.0.24 (Node >=20.11). Установка/сборка работали, но npm audit сообщил 5 low/moderate предупреждений в его цепочке dev-зависимостей; предлагаемое исправление требовало major CLI. Для каркаса CLI убран: build использует tsc, dev — встроенный Node watch и ts-node с поддержкой TypeScript decorators/metadata. Это не смена Nest/HTTP-адаптера; глобальных генераторов, обходов аудита через overrides и force-upgrade нет. Дальнейшая потребность в CLI оценивается отдельной задачей.
