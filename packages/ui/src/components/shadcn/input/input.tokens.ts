export const inputTokenNames = {
  background: "--ui-input-background",
  foreground: "--ui-input-foreground",
  borderColor: "--ui-input-border-color",
  placeholderColor: "--ui-input-placeholder-color",
  radius: "--ui-input-radius",
  focusRingColor: "--ui-input-focus-ring-color",
  shadow: "--ui-input-shadow",
} as const;

export type InputToken = (typeof inputTokenNames)[keyof typeof inputTokenNames];
