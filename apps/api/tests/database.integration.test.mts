import { afterAll, beforeAll, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  validateDatabaseTarget,
  verifyDatabaseTarget,
} from "../../../scripts/database-safety.mjs";

const require = createRequire(import.meta.url);
const {
  createDatabaseClient,
}: typeof import("../src/database/create-database-client.js") = require("../dist/database/create-database-client.js");
const url = process.env.POVOD_TEST_DATABASE_URL!;
let client: ReturnType<typeof createDatabaseClient>;

beforeAll(async () => {
  await verifyDatabaseTarget(url, "test", process.env.POVOD_TEST_DATABASE);
  client = createDatabaseClient(url);
});
afterAll(async () => {
  await client?.$disconnect();
});

test("refuses dev, remote, privileged, URL overrides and missing explicit test marker", () => {
  for (const invalid of [
    "postgresql://povod_dev:placeholder@127.0.0.1:15432/povod_dev",
    "postgresql://povod_test:placeholder@production.example/povod_test",
    "postgresql://postgres:placeholder@127.0.0.1:15432/povod_test",
    "postgresql://povod_test:placeholder@127.0.0.1:15432/povod_test?options=-csearch_path=public",
  ])
    expect(() =>
      validateDatabaseTarget(invalid, "test", "povod_test"),
    ).toThrow();
  expect(() => validateDatabaseTarget(url, "test", undefined)).toThrow();
});

test("database identity is verified against real PostgreSQL", async () => {
  await expect(
    verifyDatabaseTarget(url, "test", "povod_test"),
  ).resolves.toBeUndefined();
  const wrongDatabase = new URL(url);
  wrongDatabase.pathname = "/povod_dev";
  await expect(
    verifyDatabaseTarget(wrongDatabase.toString(), "test", "povod_test"),
  ).rejects.toThrow();
});

test("migration creates a queryable table and repeated synthetic seed remains one record", async () => {
  expect(
    await client.databaseProbe.count({ where: { id: "e106-synthetic-seed" } }),
  ).toBe(1);
});

test("real unique constraint and rollback preserve the existing record", async () => {
  const id = `e106-test-${randomUUID()}`;
  try {
    await client.databaseProbe.create({
      data: { id, label: "Synthetic integration record" },
    });
    await expect(
      client.$transaction(async (tx) => {
        await tx.databaseProbe.update({
          where: { id },
          data: { label: "Should roll back" },
        });
        await tx.databaseProbe.create({ data: { id, label: "Duplicate" } });
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(
      (await client.databaseProbe.findUniqueOrThrow({ where: { id } })).label,
    ).toBe("Synthetic integration record");
  } finally {
    // Delete only the exact random ID allocated by this test, never a shared table.
    await client.databaseProbe.deleteMany({ where: { id } });
  }
});
