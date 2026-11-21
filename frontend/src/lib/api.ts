export function getBackendBase() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    const url = configuredUrl.includes("://") ? configuredUrl : `https://${configuredUrl}`;
    return url.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return "http://localhost:3001";
}
