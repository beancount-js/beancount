import type { DocumentLoader } from "@beancount-js/beancount";

const includeCache = new Map<string, string>();

function normIncludePath(filename: string): string {
  return filename.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function cacheInclude(filename: string, contents: string) {
  includeCache.set(normIncludePath(filename), contents);
}

export function createDocumentLoader(): DocumentLoader {
  return (filename) => {
    const key = normIncludePath(filename);
    return includeCache.get(key) ?? includeCache.get(filename) ?? "";
  };
}

/** Preload beancount files served from the Vite public directory. */
export async function preloadIncludes(filenames: string[]) {
  await Promise.all(
    filenames.map(async (filename) => {
      try {
        const res = await fetch(`/${normIncludePath(filename)}`);
        if (res.ok) {
          cacheInclude(filename, await res.text());
        }
      } catch {
        // ignore missing public files
      }
    }),
  );
}
