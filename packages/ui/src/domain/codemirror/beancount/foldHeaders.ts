import { foldService } from "@codemirror/language";
export function foldHeaders(maxDepth: number = 100) {
  function headerLevel(line: string) {
    const match = /^#+/.exec(line) || /^\*+/.exec(line);
    return match?.[0]?.length ?? maxDepth;
  }
  return foldService.of(({ doc }, lineStart, lineEnd) => {
    const startLine = doc.lineAt(lineStart);
    const totalLines = doc.lines;
    const level = headerLevel(startLine.text);
    if (level === maxDepth) {
      return null;
    }
    let lineNo = startLine.number;
    let end = startLine.to;
    while (lineNo < totalLines) {
      lineNo += 1;
      const line = doc.line(lineNo);
      if (headerLevel(line.text) <= level) {
        break;
      }
      end = line.to;
    }
    return { from: lineEnd, to: end };
  });
}
