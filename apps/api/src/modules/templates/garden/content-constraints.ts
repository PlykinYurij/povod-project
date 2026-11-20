import { registerDecorator } from "class-validator";

/** Empty values are valid in a draft; completeness is checked separately. */
export function IsGardenValue(
  kind: "date" | "time" | "zone" | "route",
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: "gardenValue",
      target: target.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== "string") return false;
          if (value === "") return true;
          switch (kind) {
            case "date": {
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
                value.startsWith("0000")
              )
                return false;
              const parsed = new Date(`${value}T00:00:00.000Z`);
              return (
                Number.isFinite(parsed.getTime()) &&
                parsed.toISOString().slice(0, 10) === value
              );
            }
            case "time":
              return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
            case "zone":
              // Intl accepts numeric offsets too; this contract requires a named zone.
              if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(value))
                return false;
              try {
                new Intl.DateTimeFormat("en", { timeZone: value });
                return true;
              } catch {
                return false;
              }
            case "route":
              try {
                const url = new URL(value);
                return (
                  url.protocol === "https:" &&
                  !url.username &&
                  !url.password &&
                  !/[\x00-\x20\x7f\\]/.test(value)
                );
              } catch {
                return false;
              }
          }
        },
        defaultMessage: () => "Invalid content value",
      },
    });
  };
}
