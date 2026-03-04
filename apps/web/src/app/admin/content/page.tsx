'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Pagination } from '@/components/ui/pagination';
import { Modal } from '@/components/ui/modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate, cn } from '@/lib/utils';

/* ---------- Types ---------- */

interface FlashcardSet {
  id: string;
  title: string;
  language: string;
  createdAt: string;
  user: { id: string; email: string; username: string };
  _count: { flashcards: number };
}

interface FlashcardSetDetail {
  id: string;
  title: string;
  language: string;
  createdAt: string;
  user: { id: string; email: string; username: string };
  flashcards: Array<{
    id: string;
    front: string;
    back: string;
    explain: string | null;
    sortOrder: number;
  }>;
}

interface Quiz {
  id: string;
  title: string;
  language: string;
  score: number | null;
  totalQ: number;
  createdAt: string;
  user: { id: string; email: string; username: string };
  _count: { questions: number };
}

interface QuizDetail {
  id: string;
  title: string;
  language: string;
  score: number | null;
  totalQ: number;
  createdAt: string;
  user: { id: string; email: string; username: string };
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    sortOrder: number;
  }>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/* ---------- Component ---------- */

export default function ContentPage() {
  const [tab, setTab] = useState<'flashcards' | 'quizzes'>('flashcards');

  /* Flashcards state */
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [fcPagination, setFcPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [fcSearch, setFcSearch] = useState('');
  const [fcLoading, setFcLoading] = useState(false);
  const [fcDetail, setFcDetail] = useState<FlashcardSetDetail | null>(null);
  const [fcDetailLoading, setFcDetailLoading] = useState(false);
  const [fcModalOpen, setFcModalOpen] = useState(false);

  /* Quizzes state */
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [qzPagination, setQzPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [qzSearch, setQzSearch] = useState('');
  const [qzLoading, setQzLoading] = useState(false);
  const [qzDetail, setQzDetail] = useState<QuizDetail | null>(null);
  const [qzDetailLoading, setQzDetailLoading] = useState(false);
  const [qzModalOpen, setQzModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /* ---------- Fetch helpers ---------- */

  const fetchFlashcardSets = useCallback(async (page: number, search: string) => {
    setFcLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<{ flashcardSets: FlashcardSet[]; pagination: PaginationMeta }>(
        `/admin/flashcard-sets?${params}`,
      );
      setFlashcardSets(res.flashcardSets ?? []);
      setFcPagination(res.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcard sets');
    } finally {
      setFcLoading(false);
    }
  }, []);

  const fetchQuizzes = useCallback(async (page: number, search: string) => {
    setQzLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<{ quizzes: Quiz[]; pagination: PaginationMeta }>(
        `/admin/quizzes?${params}`,
      );
      setQuizzes(res.quizzes ?? []);
      setQzPagination(res.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes');
    } finally {
      setQzLoading(false);
    }
  }, []);

  /* Initial fetch */
  useEffect(() => {
    fetchFlashcardSets(1, '');
    fetchQuizzes(1, '');
  }, [fetchFlashcardSets, fetchQuizzes]);

  /* Search debounce for flashcards */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFlashcardSets(1, fcSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [fcSearch, fetchFlashcardSets]);

  /* Search debounce for quizzes */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuizzes(1, qzSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [qzSearch, fetchQuizzes]);

  /* ---------- Detail handlers ---------- */

  async function openFlashcardDetail(id: string) {
    setFcModalOpen(true);
    setFcDetailLoading(true);
    setFcDetail(null);
    try {
      const detail = await api.get<FlashcardSetDetail>(`/admin/flashcard-sets/${id}`);
      setFcDetail(detail);
    } catch {
      setFcDetail(null);
    } finally {
      setFcDetailLoading(false);
    }
  }

  async function openQuizDetail(id: string) {
    setQzModalOpen(true);
    setQzDetailLoading(true);
    setQzDetail(null);
    try {
      const detail = await api.get<QuizDetail>(`/admin/quizzes/${id}`);
      setQzDetail(detail);
    } catch {
      setQzDetail(null);
    } finally {
      setQzDetailLoading(false);
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-quibly-text">Content</h1>

      {error && (
        <div className="text-quibly-error text-sm bg-quibly-error/10 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'flashcards' ? 'primary' : 'secondary'}
          onClick={() => setTab('flashcards')}
        >
          Flashcards
        </Button>
        <Button
          variant={tab === 'quizzes' ? 'primary' : 'secondary'}
          onClick={() => setTab('quizzes')}
        >
          Quizzes
        </Button>
      </div>

      {/* ---------- Flashcards Tab ---------- */}
      {tab === 'flashcards' && (
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search flashcard sets..."
              value={fcSearch}
              onChange={(e) => setFcSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {fcLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="w-6 h-6" />
            </div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>User</Th>
                    <Th>Cards</Th>
                    <Th>Language</Th>
                    <Th>Created</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {flashcardSets.map((set) => (
                    <Tr
                      key={set.id}
                      className="cursor-pointer"
                      onClick={() => openFlashcardDetail(set.id)}
                    >
                      <Td className="font-medium text-quibly-text">{set.title}</Td>
                      <Td>
                        <Link
                          href={`/admin/users/${set.user.id}`}
                          className="text-quibly-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {set.user.username}
                        </Link>
                      </Td>
                      <Td>{set._count.flashcards}</Td>
                      <Td>{set.language}</Td>
                      <Td>{formatDate(set.createdAt)}</Td>
                    </Tr>
                  ))}
                  {flashcardSets.length === 0 && (
                    <Tr>
                      <Td colSpan={5} className="text-center text-quibly-text-muted py-8">
                        No flashcard sets found
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
              <Pagination
                page={fcPagination.page}
                totalPages={fcPagination.total_pages}
                onPageChange={(p) => fetchFlashcardSets(p, fcSearch)}
              />
            </>
          )}
        </Card>
      )}

      {/* ---------- Quizzes Tab ---------- */}
      {tab === 'quizzes' && (
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search quizzes..."
              value={qzSearch}
              onChange={(e) => setQzSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {qzLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="w-6 h-6" />
            </div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>User</Th>
                    <Th>Questions</Th>
                    <Th>Score</Th>
                    <Th>Language</Th>
                    <Th>Created</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {quizzes.map((quiz) => (
                    <Tr
                      key={quiz.id}
                      className="cursor-pointer"
                      onClick={() => openQuizDetail(quiz.id)}
                    >
                      <Td className="font-medium text-quibly-text">{quiz.title}</Td>
                      <Td>
                        <Link
                          href={`/admin/users/${quiz.user.id}`}
                          className="text-quibly-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {quiz.user.username}
                        </Link>
                      </Td>
                      <Td>{quiz._count.questions}</Td>
                      <Td>
                        {quiz.score !== null
                          ? `${quiz.score}/${quiz.totalQ}`
                          : <span className="text-quibly-text-muted">N/A</span>}
                      </Td>
                      <Td>{quiz.language}</Td>
                      <Td>{formatDate(quiz.createdAt)}</Td>
                    </Tr>
                  ))}
                  {quizzes.length === 0 && (
                    <Tr>
                      <Td colSpan={6} className="text-center text-quibly-text-muted py-8">
                        No quizzes found
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
              <Pagination
                page={qzPagination.page}
                totalPages={qzPagination.total_pages}
                onPageChange={(p) => fetchQuizzes(p, qzSearch)}
              />
            </>
          )}
        </Card>
      )}

      {/* ---------- Flashcard Detail Modal ---------- */}
      <Modal open={fcModalOpen} onClose={() => setFcModalOpen(false)} className="max-w-2xl">
        {fcDetailLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-6 h-6" />
          </div>
        ) : fcDetail ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-quibly-text">{fcDetail.title}</h2>
                <p className="text-sm text-quibly-text-muted mt-1">
                  by{' '}
                  <Link
                    href={`/admin/users/${fcDetail.user.id}`}
                    className="text-quibly-primary hover:underline"
                  >
                    {fcDetail.user.username}
                  </Link>
                  {' '}&middot; {formatDate(fcDetail.createdAt)} &middot; {fcDetail.language}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFcModalOpen(false)}>
                Close
              </Button>
            </div>

            <p className="text-sm text-quibly-text-secondary">
              {fcDetail.flashcards.length} flashcard{fcDetail.flashcards.length !== 1 ? 's' : ''}
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {fcDetail.flashcards
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((card, i) => (
                  <Card key={card.id} className="p-4">
                    <p className="text-xs text-quibly-text-muted mb-2">Card {i + 1}</p>
                    <p className="text-sm font-medium text-quibly-text mb-1">
                      <span className="text-quibly-text-muted">Front:</span> {card.front}
                    </p>
                    <p className="text-sm text-quibly-text-secondary">
                      <span className="text-quibly-text-muted">Back:</span> {card.back}
                    </p>
                    {card.explain && (
                      <p className="text-xs text-quibly-text-muted mt-2 italic">
                        {card.explain}
                      </p>
                    )}
                  </Card>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-quibly-text-muted text-center py-8">Failed to load flashcard set</p>
        )}
      </Modal>

      {/* ---------- Quiz Detail Modal ---------- */}
      <Modal open={qzModalOpen} onClose={() => setQzModalOpen(false)} className="max-w-2xl">
        {qzDetailLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-6 h-6" />
          </div>
        ) : qzDetail ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-quibly-text">{qzDetail.title}</h2>
                <p className="text-sm text-quibly-text-muted mt-1">
                  by{' '}
                  <Link
                    href={`/admin/users/${qzDetail.user.id}`}
                    className="text-quibly-primary hover:underline"
                  >
                    {qzDetail.user.username}
                  </Link>
                  {' '}&middot; {formatDate(qzDetail.createdAt)} &middot; {qzDetail.language}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setQzModalOpen(false)}>
                Close
              </Button>
            </div>

            <p className="text-sm text-quibly-text-secondary">
              {qzDetail.questions.length} question{qzDetail.questions.length !== 1 ? 's' : ''}
              {qzDetail.score !== null && (
                <span>
                  {' '}&middot; Score: {qzDetail.score}/{qzDetail.totalQ}
                </span>
              )}
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {qzDetail.questions
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((q, i) => (
                  <Card key={q.id} className="p-4">
                    <p className="text-xs text-quibly-text-muted mb-2">Question {i + 1}</p>
                    <p className="text-sm font-medium text-quibly-text mb-3">{q.question}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'text-sm px-3 py-1.5 rounded-lg',
                            idx === q.correctIndex
                              ? 'bg-quibly-success/20 text-quibly-success font-medium'
                              : 'bg-quibly-surface-light text-quibly-text-secondary',
                          )}
                        >
                          {String.fromCharCode(65 + idx)}. {opt}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-quibly-text-muted text-center py-8">Failed to load quiz</p>
        )}
      </Modal>
    </div>
  );
}
