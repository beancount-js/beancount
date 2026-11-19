const REQUIREMENT_ID = /^BC-[A-Z]+-\d{3}/;

/** Use the stable requirement id as the visible Storybook contents label. */
export function requirementTocLabel(heading: string): string {
  const text = heading.trim();
  return text.match(REQUIREMENT_ID)?.[0] ?? text;
}
