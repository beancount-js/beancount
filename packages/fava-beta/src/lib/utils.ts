type ClassDictionary = Record<string, unknown>;
export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassDictionary
  | ClassValue[];

export function cn(...inputs: ClassValue[]) {
  const classes: string[] = [];

  function append(value: ClassValue) {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    for (const [className, enabled] of Object.entries(value)) {
      if (enabled) classes.push(className);
    }
  }

  inputs.forEach(append);
  return classes.join(" ");
}
