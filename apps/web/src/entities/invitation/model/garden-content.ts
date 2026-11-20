import type { GardenContentDto, GardenCopyDto } from "@shared/api/server";

type ImmutableContent<T> = T extends object
  ? { readonly [Key in keyof T]: ImmutableContent<T[Key]> }
  : T;

export type GardenCopy = Readonly<GardenCopyDto>;

/** Read-only renderer view of the generated contract; runtime validation belongs to Nest. */
export type GardenContent = ImmutableContent<GardenContentDto>;

/** A resolved display asset; the renderer never fetches private keys or raw uploads. */
export interface GardenMedia {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}
