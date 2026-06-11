import { formatDate } from "@beancount-js/parser";
/** Get the URL string for one of Fava's reports. */
export function urlFor(
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const url = path.startsWith("#")
    ? path
    : `#${path.startsWith("/") ? path : `/${path}`}`;
  const urlParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        urlParams.set(key, value.toString());
      }
    });
  }
  const urlParamString = urlParams.toString();
  return urlParamString ? `${url}?${urlParamString}` : url;
}

/** URL for the account report (derived store to keep track of filter changes.). */
export function urlForAccount(
  account: string | null | undefined,
  params?: Record<string, string>,
) {
  if (!account) {
    return "/accounts";
  }
  return urlFor(`/account/${account}/`, params);
}

export function urlForDate(
  date: Date | null | undefined,
  params?: Record<string, string>,
) {
  if (!date) {
    return "#";
  }
  return urlFor("", { ...(params || {}), query: formatDate(date) });
}
