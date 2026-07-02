export function formatActivityActorUsername(username: string | null | undefined): string | null {
  const normalized = username?.trim().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;

  return normalized
    .split(" ")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
