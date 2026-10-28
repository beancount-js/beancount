/** Preserve pointer activation of a record without nesting controls in a button. */
export function rowOpen(node: HTMLElement, open: () => void) {
  let activate = open;
  const click = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        'button,a,input,select,textarea,[role="button"],[role="switch"]',
      )
    )
      return;
    activate();
  };
  node.addEventListener("click", click);
  return {
    update(next: () => void) {
      activate = next;
    },
    destroy() {
      node.removeEventListener("click", click);
    },
  };
}
