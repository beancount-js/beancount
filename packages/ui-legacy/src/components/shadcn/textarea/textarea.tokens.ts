export const textareaTokenNames = {
  background: "--ui-textarea-background",
  foreground: "--ui-textarea-foreground",
  borderColor: "--ui-textarea-border-color",
  placeholderColor: "--ui-textarea-placeholder-color",
  radius: "--ui-textarea-radius",
  focusRingColor: "--ui-textarea-focus-ring-color",
  shadow: "--ui-textarea-shadow",
} as const;

export type TextareaToken =
  (typeof textareaTokenNames)[keyof typeof textareaTokenNames];
