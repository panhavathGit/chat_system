export type MediaCategory = 'IMAGE' | 'VOICE' | 'FILE';

// * Declared by the client, so treat it as a filter, not proof; files are always served with this stored type
export const allowedMediaTypes: Record<string, MediaCategory> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/heic': 'IMAGE',
  'image/heif': 'IMAGE',
  'image/webp': 'IMAGE',
  'audio/mp4': 'VOICE',
  'audio/m4a': 'VOICE',
  'audio/x-m4a': 'VOICE',
  'audio/aac': 'VOICE',
  'audio/mpeg': 'VOICE',
  'application/pdf': 'FILE',
  'application/msword': 'FILE',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'FILE',
  'application/vnd.ms-excel': 'FILE',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'FILE',
};

export const mediaCategoryOf = (mimeType: string): MediaCategory | null => allowedMediaTypes[mimeType] ?? null;
