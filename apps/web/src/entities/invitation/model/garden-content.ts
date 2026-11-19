/** Renderer input, not an API DTO or the final publication validation schema. */
export interface GardenContent {
  readonly themeId: "sage" | "sand";
  readonly names: { readonly first: string; readonly second: string };
  readonly event: {
    readonly localDate: string;
    readonly localTime: string;
    readonly timeZone: string;
  };
  readonly venue: {
    readonly name: string;
    readonly address: string;
    readonly routeUrl: string | null;
  };
  readonly program:
    readonly { readonly time: string; readonly text: string }[] | null;
  readonly heroMediaId: string | null;
}

/** A resolved display asset; the renderer never fetches private keys or raw uploads. */
export interface GardenMedia {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}
