const BACKGROUNDS = [
  "#e0f2fe",
  "#dcfce7",
  "#fef3c7",
  "#fae8ff",
  "#fee2e2",
  "#e0e7ff",
];

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return character;
    }
  });
}

function stableIndex(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
}

/**
 * A same-origin image response for an unavailable Logo API asset. It avoids a
 * broken image/404 in the browser while a later request can retry the
 * provider.
 */
export function logoFallbackResponse(label: string) {
  const words = label
    .trim()
    .split(/[\s:_-]+/)
    .filter(Boolean);
  const text =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word.slice(0, 1))
          .join("")
          .toUpperCase()
      : (words[0]?.slice(0, 2).toUpperCase() ?? "?");
  const background =
    BACKGROUNDS[stableIndex(label.toLowerCase()) % BACKGROUNDS.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-label="${escapeSvgText(label)}"><rect width="40" height="40" rx="20" fill="${background}"/><text x="20" y="24.5" text-anchor="middle" fill="#334155" font-family="system-ui, sans-serif" font-size="${text.length > 1 ? "14" : "17"}" font-weight="600">${escapeSvgText(text)}</text></svg>`;
  return new Response(svg, {
    headers: {
      "cache-control": "private, max-age=300",
      "content-type": "image/svg+xml; charset=utf-8",
      "x-logo-fallback": "true",
    },
  });
}
