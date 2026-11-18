import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { ApiError } from "../../http/api-error";

export interface ResetMessage {
  id: string;
  to: string;
  code: string;
  expiresAt: string;
}

/** Local-only mail sink. No network transport and no HTTP inbox endpoint. */
@Injectable()
export class ResetMailService {
  private directory(): string {
    const path = process.env.LOCAL_MAIL_DIR;
    if (process.env.NODE_ENV === "production" || !path || !isAbsolute(path))
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Восстановление временно недоступно");
    return path;
  }
  async ready(): Promise<void> {
    await mkdir(this.directory(), { recursive: true, mode: 0o700 });
  }
  async send(message: ResetMessage): Promise<void> {
    // Random server UUID, never an email/filename from the request.
    await writeFile(join(this.directory(), `${message.id}.json`), JSON.stringify({
      purpose: "password-reset", ...message,
      subject: "Код восстановления пароля «Повод»",
      text: `Код: ${message.code}. Действует 10 минут. Если вы не запрашивали восстановление, проигнорируйте письмо.`,
    }), { encoding: "utf8", flag: "wx", mode: 0o600 });
  }
}
