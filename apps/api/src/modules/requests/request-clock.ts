import { Injectable } from "@nestjs/common";

@Injectable()
export class RequestClock {
  now(): Date {
    return new Date();
  }
}
