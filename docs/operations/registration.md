# Backend регистрации · E1-04d

Актуальная [регистрация с подтверждением email-кодом](registration-confirmation.md), [QA](../qa/e1-04d-report.md). Start теперь возвращает 202 без User/Session; только confirm даёт 201 и автоматический вход. Старые инструкции немедленного register+Session относятся к исторической E1-04b и больше не описывают контракт. Web/production-почта ещё не реализованы.
