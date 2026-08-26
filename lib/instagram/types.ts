/** Shapes shared between the worker and the page. */

export type MessageKind =
  | 'text'
  | 'photo'
  | 'video'
  | 'audio'
  | 'gif'
  | 'sticker'
  | 'share'
  | 'removed'
  | 'unknown';

export interface Message {
  /** Position in the merged, ascending-by-time thread. The jump target. */
  i: number;
  ts: number;
  sender: string;
  kind: MessageKind;
  /** Present for text, share captions, and the label of an unknown row. */
  text?: string;
  /** Archive path of the attachment, resolved on demand. */
  uri?: string;
  /** What to show when media is not being rendered: "Photo", "Video" … */
  label?: string;
  reactions?: { reaction: string; actor: string }[];
}

export interface ThreadSummary {
  /** Directory inside the archive; the thread's identity. */
  key: string;
  title: string;
  participants: string[];
  messageCount: number;
  lastTs: number;
  /** How many files this thread's messages were split across. */
  fileCount: number;
  mediaCount: number;
}

export interface ArchiveIndex {
  threads: ThreadSummary[];
  /** Bytes of media in the archive, from the central directory — nothing read. */
  mediaBytes: number;
  mediaCount: number;
  /** The sender present in the most threads. */
  ownerGuess: string;
  /** Every distinct sender, so the guess can be overridden. */
  senders: string[];
  totalMessages: number;
  /** Set when the archive has no message JSON, to explain what it did have. */
  problem?: { kind: 'html-export' | 'no-messages'; folders: string[] };
}

export interface SearchHit {
  threadKey: string;
  threadTitle: string;
  i: number;
  ts: number;
  sender: string;
  text: string;
}
