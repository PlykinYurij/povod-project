import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "./create-database-client";
import { ApiError } from "../http/api-error";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client?: ReturnType<typeof createDatabaseClient>;
  getClient(): ReturnType<typeof createDatabaseClient> {
    if (!process.env.DATABASE_URL)
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "База данных не настроена",
      );
    return (this.client ??= createDatabaseClient(process.env.DATABASE_URL));
  }
  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
