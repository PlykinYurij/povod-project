import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/** Caller owns the lifecycle; no implicit connections on module import. */
export function createDatabaseClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 5000,
      max: 5,
    }),
    errorFormat: "minimal",
  });
}
