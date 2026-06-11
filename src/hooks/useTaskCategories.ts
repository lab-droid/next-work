import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

export interface CategoryData {
  main: string;
  subs: string[];
}

export const DEFAULT_CATEGORIES: CategoryData[] = [
  { main: '대기', subs: ['제작대기', '요청', '신규문의'] },
  { main: '진행', subs: ['진행중', '피드백 요청', '일정조율중', '가망있음'] },
  { main: '완료', subs: ['완료'] },
  { main: '보류', subs: ['가망없음', '연락두절', '부분환불', '전액환불', '중복건'] }
];

export function useTaskCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryData[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'settings', 'task_categories'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().categories) {
        setCategories(docSnap.data().categories);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const saveCategories = async (newCategories: CategoryData[]) => {
    await setDoc(doc(db, 'settings', 'task_categories'), { categories: newCategories }, { merge: true });
  };

  return { categories, saveCategories, loading };
}
