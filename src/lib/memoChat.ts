const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface MemoChatTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: { name: string; size: number }[];
}

export interface MemoSignOff {
  lawyerName: string;
  signedAt: string;
  signatureDataUrl?: string;
}

export interface SupportingDocumentMeta {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export interface MemoChatState {
  history: MemoChatTurn[];
  signOff: MemoSignOff | null;
  documents: SupportingDocumentMeta[];
}

export async function fetchMemoChatState(sessionId: string): Promise<MemoChatState> {
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/memo-chat`);
  if (!res.ok) throw new Error(`Failed to load memo chat state: ${res.status}`);
  return res.json();
}

export interface SendMemoChatResult {
  reply: string;
  memoMarkdown: string;
  executiveSummary: string;
  history: MemoChatTurn[];
}

export async function sendMemoChatMessage(
  sessionId: string,
  message: string,
): Promise<SendMemoChatResult> {
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/memo-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Memo chat request failed: ${res.status}`);
  }
  return res.json();
}

export async function submitSignOff(
  sessionId: string,
  lawyerName: string,
  signatureDataUrl?: string,
): Promise<MemoSignOff> {
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/sign-off`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lawyerName, signatureDataUrl }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Sign-off failed: ${res.status}`);
  }
  const { signOff } = (await res.json()) as { signOff: MemoSignOff };
  return signOff;
}

export async function revokeSignOff(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/api/analysis/${sessionId}/sign-off`, { method: "DELETE" });
}

export async function uploadSupportingDocument(
  sessionId: string,
  file: File,
): Promise<SupportingDocumentMeta> {
  const textExcerpt = await readFileAsText(file);
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      textExcerpt,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }
  const { document } = (await res.json()) as { document: SupportingDocumentMeta };
  return document;
}

export async function deleteSupportingDocument(
  sessionId: string,
  docId: string,
): Promise<void> {
  await fetch(`${API_URL}/api/analysis/${sessionId}/documents/${docId}`, {
    method: "DELETE",
  });
}

// Best-effort text extraction. For .txt / .md we get full content; for binary
// formats (PDF/docx) the excerpt may be empty or garbled — the backend still
// registers the attachment for citation purposes.
async function readFileAsText(file: File): Promise<string | undefined> {
  const textLike = /\.(txt|md|markdown|csv|json|xml|html|rtf)$/i.test(file.name);
  if (!textLike) return undefined;
  try {
    const text = await file.text();
    return text.slice(0, 20000);
  } catch {
    return undefined;
  }
}
