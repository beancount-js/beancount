export const badgeTokenNames = {
  background: "--ui-badge-background",
  foreground: "--ui-badge-foreground",
  borderColor: "--ui-badge-border-color",
  radius: "--ui-badge-radius",
  focusRingColor: "--ui-badge-focus-ring-color",
  successBackground: "--ui-badge-success-background",
  successForeground: "--ui-badge-success-foreground",
  warningBackground: "--ui-badge-warning-background",
  warningForeground: "--ui-badge-warning-foreground",
} as const;

export type BadgeToken = (typeof badgeTokenNames)[keyof typeof badgeTokenNames];
