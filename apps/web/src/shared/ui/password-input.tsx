"use client";

import {
  PasswordInput as MantinePasswordInput,
  type PasswordInputProps,
} from "@mantine/core";
import type { Ref } from "react";

/** Keep errors available to assistive technology and visibility control to the keyboard. */
export function PasswordInput({
  ref,
  ...props
}: PasswordInputProps & { ref?: Ref<HTMLInputElement> }) {
  return (
    <MantinePasswordInput
      ref={ref}
      visibilityToggleFocusable
      {...props}
      aria-invalid={props["aria-invalid"] ?? (!!props.error || undefined)}
    />
  );
}
