// SPDX-License-Identifier: GPL-2.0-only
// Derived from beancount/parser/version.py at a3cb3fd9f946d6213dd350fb87709a8ef198301d.
// Copyright (C) 2018, 2020-2021, 2024-2025 Martin Blais

import { DateTime } from "luxon";

/** Render package and source-build information with the upstream convention. */
export function computeVersionString(
  version: string,
  changeset: string | null | undefined,
  timestamp: number | null | undefined,
): string {
  let shortChangeset = changeset ?? "";
  if (shortChangeset.startsWith("hg:"))
    shortChangeset = shortChangeset.slice(0, 15);
  else if (shortChangeset.startsWith("git:"))
    shortChangeset = shortChangeset.slice(0, 12);

  const date =
    timestamp && timestamp > 0
      ? DateTime.fromSeconds(timestamp, { zone: "utc" }).toISODate()
      : null;
  const result = `Beancount ${version}`;
  const details = [shortChangeset, date].filter(Boolean).join("; ");
  return details ? `${result} (${details})` : result;
}
