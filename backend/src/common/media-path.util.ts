import * as path from 'path';

export function toPublicMediaPath(
  filePath: string | null | undefined,
  publicPrefix: string,
): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith(`${publicPrefix}/`)) return filePath;

  return `${publicPrefix}/${encodeURIComponent(path.basename(filePath))}`;
}

