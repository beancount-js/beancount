import { type ClassValue, clsx } from "clsx";

/** Join conditional native classes for UI-owned components. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
