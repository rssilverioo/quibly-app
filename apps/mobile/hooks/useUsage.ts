import { useState, useCallback, useEffect } from 'react';
import { getUsage, type UsageResponse } from '../services/usage';

export function useUsage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUsage();
      setUsage(data);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const canCreate = useCallback((type: 'flashcard_sets' | 'quizzes'): boolean => {
    if (!usage) return true;
    if (usage.plan === 'PRO') return true;
    const bucket = usage[type];
    return bucket.used < bucket.limit;
  }, [usage]);

  return { usage, isLoading, refresh, canCreate };
}
