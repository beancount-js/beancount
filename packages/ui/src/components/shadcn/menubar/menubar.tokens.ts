export const menubarTokenNames = {
  background: "--ui-menubar-background",
  foreground: "--ui-menubar-foreground",
  borderColor: "--ui-menubar-border-color",
  radius: "--ui-menubar-radius",
} as const;

export type MenubarToken =
  (typeof menubarTokenNames)[keyof typeof menubarTokenNames];
