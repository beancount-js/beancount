const FALLBACK_COLORS = [
  "#E11D48",
  "#EA580C",
  "#CA8A04",
  "#0284C7",
  "#7C3AED",
  "#0F766E",
] as const;

export function accountAvatarInitial(account: string): string {
  const leaf = account.split(":").filter(Boolean).at(-1)?.trim() ?? "";
  return (leaf.charAt(0) || "?").toUpperCase();
}

export function accountAvatarFallbackColor(account: string): string {
  const initial = accountAvatarInitial(account);
  const colorIndex = initial.charCodeAt(0) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[colorIndex] ?? FALLBACK_COLORS[0];
}

/** A portable fallback avatar for picker APIs that accept decorative images. */
export function accountAvatarImageDataUrl(account: string): string {
  const initial = accountAvatarInitial(account);
  const color = accountAvatarFallbackColor(account);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${color}" fill-opacity=".1"/><text x="16" y="17" fill="${color}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="600" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
