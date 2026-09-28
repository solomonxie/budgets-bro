import { bytesToUtf8, utf8ToBytes } from '../files/bytes';
import { documentDir, joinPath, readBytes, writeBytes } from '../files/fileStore';

// Documents/feedback.json, outside the DB so `xcrun devicectl` can pull and
// push it (see ~/.claude/skills/app-feedback). Every write re-reads first and
// unknown fields pass through untouched.
export const FEEDBACK_PATH = joinPath(documentDir, 'feedback.json');

export const FEEDBACK_STATUSES = ['open', 'in_progress', 'done', 'wontfix'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackItem {
  id: string;
  text: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  note?: string;
  [key: string]: unknown;
}

export interface FeedbackFile {
  version: number;
  items: FeedbackItem[];
  [key: string]: unknown;
}

export function parseFeedback(json: string | null): FeedbackFile {
  if (json == null || json.trim() === '') return { version: 1, items: [] };
  const parsed = JSON.parse(json) as Partial<FeedbackFile>;
  return {
    ...parsed,
    version: parsed.version ?? 1,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

export function newestFirst(items: FeedbackItem[]): FeedbackItem[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function openCount(items: FeedbackItem[]): number {
  return items.filter((item) => item.status === 'open').length;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function withAdded(file: FeedbackFile, text: string, now = new Date()): FeedbackFile {
  const at = now.toISOString();
  const item: FeedbackItem = { id: uuid(), text, status: 'open', createdAt: at, updatedAt: at, note: '' };
  return { ...file, items: [...file.items, item] };
}

export function withStatus(file: FeedbackFile, id: string, status: FeedbackStatus, now = new Date()): FeedbackFile {
  return {
    ...file,
    items: file.items.map((item) =>
      item.id === id ? { ...item, status, updatedAt: now.toISOString() } : item,
    ),
  };
}

export function withRemoved(file: FeedbackFile, id: string): FeedbackFile {
  return { ...file, items: file.items.filter((item) => item.id !== id) };
}

export async function readFeedback(): Promise<FeedbackFile> {
  const bytes = await readBytes(FEEDBACK_PATH);
  return parseFeedback(bytes ? bytesToUtf8(bytes) : null);
}

export async function updateFeedback(change: (file: FeedbackFile) => FeedbackFile): Promise<FeedbackFile> {
  const next = change(await readFeedback());
  await writeBytes(FEEDBACK_PATH, utf8ToBytes(JSON.stringify(next, null, 2)));
  return next;
}
