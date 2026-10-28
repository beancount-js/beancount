export function debounceWithDelay(
  cb: (...args: any[]) => void,
  timeout: number,
) {
  let lastTimeout: number | null;
  let lastArgs: any[];

  function set() {
    lastTimeout = window.setTimeout(() => {
      cb(...lastArgs);
      lastTimeout = null;
    }, timeout);
  }

  function debouncedFn(...args: any[]) {
    lastArgs = args;

    if (!lastTimeout) {
      set();
    }
  }

  function delay() {
    if (lastTimeout) {
      clearTimeout(lastTimeout);
      set();
    }
  }

  return [debouncedFn, delay];
}
