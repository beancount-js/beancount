export const buttonTokenNames = {
  background: "--ui-button-background",
  foreground: "--ui-button-foreground",
  borderColor: "--ui-button-border-color",
  radius: "--ui-button-radius",
  focusRingColor: "--ui-button-focus-ring-color",
  shadow: "--ui-button-shadow",
} as const;

export type ButtonToken =
  (typeof buttonTokenNames)[keyof typeof buttonTokenNames];
