export const progressTokenNames = {
  background: "--ui-progress-background",
  foreground: "--ui-progress-foreground",
  borderColor: "--ui-progress-border-color",
  radius: "--ui-progress-radius",
} as const;

export type ProgressToken =
  (typeof progressTokenNames)[keyof typeof progressTokenNames];
