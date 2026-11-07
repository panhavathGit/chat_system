import type { Readable } from 'node:stream';

// * Chat code only sees this interface, so a GCS/S3 driver can replace local disk without touching the services
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  getStream(key: string): Readable;
  delete(key: string): Promise<void>;
}
