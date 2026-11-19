import { Button, createTheme } from "@mantine/core";

export const identityTheme = createTheme({
  colors: {
    povod: [
      "#f0f6f0",
      "#e3eee4",
      "#cee1cf",
      "#b0d6b7",
      "#85b993",
      "#639b76",
      "#467b59",
      "#315f4b",
      "#254b39",
      "#183426",
    ],
  },
  primaryColor: "povod",
  primaryShade: { light: 7, dark: 3 },
  autoContrast: true,
  components: {
    Button: Button.extend({
      styles: { root: { minHeight: "var(--identity-control-height, 46px)" } },
    }),
  },
  defaultRadius: "md",
  fontFamily: "system-ui, sans-serif",
});
