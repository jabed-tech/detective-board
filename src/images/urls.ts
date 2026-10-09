const cache = new Map<string, string>();

export async function imageUrl(id: string, getBlob: (id: string) => Promise<Blob | undefined>): Promise<string | undefined> {
  const hit = cache.get(id);
  if (hit) return hit;
  const blob = await getBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  cache.set(id, url);
  return url;
}

export function revokeAllImageUrls(): void {
  for (const u of cache.values()) URL.revokeObjectURL(u);
  cache.clear();
}
