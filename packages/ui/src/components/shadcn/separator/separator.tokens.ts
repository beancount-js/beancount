export const separatorTokenNames = {
  color: "--ui-separator-color",
  thickness: "--ui-separator-thickness",
} as const;

export type SeparatorToken =
  (typeof separatorTokenNames)[keyof typeof separatorTokenNames];
