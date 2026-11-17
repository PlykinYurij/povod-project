-- Disposable CI container only. Never run against a shared database.
CREATE ROLE povod_test LOGIN PASSWORD 'synthetic-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE povod_test OWNER povod_test;
REVOKE CONNECT, TEMPORARY ON DATABASE povod_test FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE povod_test TO povod_test;
REVOKE CONNECT ON DATABASE postgres, template1 FROM PUBLIC;
\connect povod_test
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
