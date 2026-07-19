/**
 * Storybook never owns the browser's SvelteKit router. Fava components may
 * still import `goto`, so provide the harmless subset needed by catalog
 * fixtures. Stories assert against the Fava in-memory router instead.
 */
export async function goto(
  _href: string | URL,
  _options?: Record<string, unknown>,
) {}
