import { useState, useCallback } from 'react';
import { awardXp, type XpResult } from '../services/gamification';

export function useGamification() {
  const [lastXpResult, setLastXpResult] = useState<XpResult | null>(null);
  const [isAwarding, setIsAwarding] = useState(false);

  const award = useCallback(async (action: 'flashcard_review' | 'quiz_correct' | 'quiz_wrong') => {
    setIsAwarding(true);
    try {
      const result = await awardXp(action);
      setLastXpResult(result);
      return result;
    } finally {
      setIsAwarding(false);
    }
  }, []);

  const clearLastResult = useCallback(() => setLastXpResult(null), []);

  return { award, lastXpResult, clearLastResult, isAwarding };
}
