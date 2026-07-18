/**
 * Expand beanquery shell convenience commands into SELECT statements.
 * Mirrors upstream beanquery/Fava BALANCES / JOURNAL shortcuts.
 */
export function expandShellQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return trimmed;
  }

  const balances = /^(balances?)\b(.*)$/is.exec(trimmed);
  if (balances) {
    const rest = balances[2].trim();
    // Match beanquery/Fava column naming: sum((position)).
    return rest
      ? `SELECT account, sum((position)) ${rest} GROUP BY account`
      : "SELECT account, sum((position)) GROUP BY account";
  }

  const journal = /^(journal)\b(?:\s+('[^']*'|"[^"]*"|\S+))?(.*)$/is.exec(
    trimmed,
  );
  if (journal) {
    const account = journal[2]?.replace(/^['"]|['"]$/g, "");
    const rest = journal[3].trim();
    const where = account
      ? `WHERE account ~ '${account.replace(/'/g, "\\'")}'`
      : "";
    const parts = [
      "SELECT date, flag, payee, narration, account, position, balance",
      rest,
      where,
    ]
      .filter(Boolean)
      .join(" ");
    return parts.replace(/\s+/g, " ").trim();
  }

  const print = /^(print)\b(.*)$/is.exec(trimmed);
  if (print) {
    const rest = print[2].trim();
    return rest ? `SELECT * ${rest}` : "SELECT *";
  }

  return trimmed;
}
