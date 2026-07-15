/** Escape text for safe HTML interpolation. */
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(value: string) {
  let text = escapeHtml(value);
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="font-medium text-foreground underline underline-offset-2">$1</a>',
  );
  text = text.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-medium text-foreground">$1</strong>',
  );
  text = text.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">$1</code>',
  );
  return text;
}

/**
 * Small trusted markdown subset for connection setup copy.
 * Supports paragraphs, ordered/unordered lists, links, bold, and inline code.
 */
export function renderSetupMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listType: "ol" | "ul" | null = null;
  let listItems: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }
    const tag = listType;
    blocks.push(
      `<${tag} class="list-${tag === "ol" ? "decimal" : "disc"} space-y-1 pl-4">${listItems
        .map((item) => `<li>${formatInline(item)}</li>`)
        .join("")}</${tag}>`,
    );
    listType = null;
    listItems = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(ordered[1] ?? "");
      continue;
    }
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(unordered[1] ?? "");
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}

export function setupHost(endpoint: string | undefined) {
  if (!endpoint?.trim()) return "your provider";
  try {
    return new URL(endpoint).hostname || "your provider";
  } catch {
    return "your provider";
  }
}

export function setupHref(endpoint: string | undefined) {
  if (!endpoint?.trim()) return undefined;
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}
