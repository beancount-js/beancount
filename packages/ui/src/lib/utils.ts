import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional Tailwind utility classes for UI-owned components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
