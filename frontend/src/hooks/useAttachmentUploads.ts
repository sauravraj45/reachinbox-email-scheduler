'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadItem {
  key: string;
  filename: string;
  size: number;
  contentType: string;
  previewUrl?: string;
  status: 'uploading' | 'done';
  id?: string;
}

/** Compose-side attachments: uploads each picked file immediately, exposes ids for scheduling. */
export function useAttachmentUploads(onError: (msg: string) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Free object URLs when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []);

  const add = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const room = MAX_FILES - itemsRef.current.length;
      if (list.length > room) onError(`You can attach up to ${MAX_FILES} files.`);
      for (const file of list.slice(0, Math.max(0, room))) {
        if (file.size > MAX_BYTES) {
          onError(`${file.name} is larger than 5 MB.`);
          continue;
        }
        const key = `${file.name}-${file.size}-${Math.random()}`;
        const item: UploadItem = {
          key,
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          status: 'uploading',
        };
        setItems((prev) => [...prev, item]);
        api
          .uploadAttachment(file)
          .then((meta) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'done', id: meta.id } : i))))
          .catch((err: Error) => {
            onError(`Upload failed for ${file.name}: ${err.message}`);
            setItems((prev) => prev.filter((i) => i.key !== key));
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          });
      }
    },
    [onError],
  );

  const remove = useCallback((key: string) => {
    const item = itemsRef.current.find((i) => i.key === key);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.id) void api.deleteAttachment(item.id).catch(() => undefined);
  }, []);

  return {
    items,
    add,
    remove,
    uploading: items.some((i) => i.status === 'uploading'),
    ids: items.filter((i) => i.id).map((i) => i.id!),
  };
}
