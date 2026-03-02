import { api } from '../lib/api';
import type { Document } from '@quibly/shared';

export interface DocumentWithCounts extends Document {
  _count: { flashcard_sets: number; quizzes: number };
}

export async function uploadDocument(
  file: { uri: string; name: string; type: string },
  title: string,
  subject?: string,
): Promise<Document> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
  formData.append('title', title);
  if (subject) formData.append('subject', subject);

  return api.upload<Document>('/documents/upload', formData);
}

export async function listDocuments(): Promise<DocumentWithCounts[]> {
  return api.get<DocumentWithCounts[]>('/documents');
}

export async function getDocument(id: string): Promise<Document> {
  return api.get<Document>(`/documents/${id}`);
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}
