import { writable } from "svelte/store";

/** A minimal page store for Fava's in-memory router in Storybook. */
export const page = writable({ url: new URL("http://localhost/") });
