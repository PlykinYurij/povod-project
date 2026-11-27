INSERT INTO templates (id, category_id, title_ru, title_en)
VALUES ('confetti', 'birthday', 'Конфетти', 'Confetti');

INSERT INTO template_versions (id, template_id, schema_version, renderer_key, defaults_version, available_for_new_projects)
VALUES ('birthday-confetti-v1', 'confetti', 1, 'confetti-v1', 1, false);
