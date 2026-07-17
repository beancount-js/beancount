/** Brandfetch Logo API uses a public CDN URL and a client ID per image. */
export function brandfetchLogoUrl(domain: string, clientId: string) {
  const identifier = encodeURIComponent(domain.toLowerCase());
  const client = encodeURIComponent(clientId);
  return `https://cdn.brandfetch.io/domain/${identifier}/h/128/w/128/icon.png?c=${client}`;
}

export function isValidDomain(value: string | undefined) {
  if (!value || value.length > 253 || /[/:?#\s]/.test(value)) return false;
  const domain = value.toLowerCase().replace(/\.$/, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  );
}
