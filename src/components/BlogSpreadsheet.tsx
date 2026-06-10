import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface BlogResult {
  id: string;
  userId: string;
  customerId: string;
  assigneeId?: string | null;
  title: string;
  url: string;
  publishDate: string;
  views: number;
  createdAt: number;
}

interface UserData {
  id: string;
  displayName?: string;
  email: string;
  companyCode?: string | null;
}

import { useModal } from '../lib/ModalContext';

export default function BlogSpreadsheet({ customerId }: { customerId: string }) {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [results, setResults] = useState<BlogResult[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
       if (doc.exists()) setCompanyCode(doc.data().companyCode || null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'blogResults'),
      where('userId', '==', user.uid),
      where('customerId', '==', customerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BlogResult[];
      data.sort((a, b) => a.createdAt - b.createdAt);
      setResults(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'blogResults'));

    return () => unsubscribe();
  }, [user, customerId]);

  useEffect(() => {
    const uq = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uq, (snapshot) => {
      let uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserData[];
      if (companyCode) {
        uData = uData.filter(u => u.companyCode === companyCode);
      } else {
        uData = uData.filter(u => !u.companyCode);
      }
      setUsers(uData);
    }, error => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribeUsers();
  }, [companyCode]);

  const handleAddRow = async () => {
    if (!user) return;
    const newId = doc(collection(db, 'blogResults')).id;
    try {
      await setDoc(doc(db, 'blogResults', newId), {
        userId: user.uid,
        customerId,
        assigneeId: user.uid,
        title: '',
        url: '',
        publishDate: format(new Date(), 'yyyy-MM-dd'),
        views: 0,
        createdAt: Date.now()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'blogResults');
    }
  };

  const handleUpdate = async (id: string, field: keyof BlogResult, value: any) => {
    try {
      await updateDoc(doc(db, 'blogResults', id), {
        [field]: value
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'blogResults');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '기록을 삭제하시겠습니까?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'blogResults', id));
        } catch(err) {
          handleFirestoreError(err, OperationType.DELETE, 'blogResults');
        }
      }
    });
  };

  return (
    <div className="w-full relative">
      <div className="flex justify-between mb-4 mt-2">
        <h4 className="font-bold text-gray-700">블로그 성과 기록</h4>
        <button onClick={handleAddRow} className="text-sm bg-brand-50 text-brand-600 hover:bg-brand-100 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" /> 행 추가
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-2 px-3 font-semibold text-gray-600 w-1/5">담당자</th>
              <th className="py-2 px-3 font-semibold text-gray-600 w-1/4">포스팅 제목</th>
              <th className="py-2 px-3 font-semibold text-gray-600 w-1/4">URL</th>
              <th className="py-2 px-3 font-semibold text-gray-600 w-1/6">발행일</th>
              <th className="py-2 px-3 font-semibold text-gray-600 w-1/6">조회수</th>
              <th className="py-2 px-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                <td className="p-0 border-r border-gray-100 last:border-r-0">
                  <select
                    value={r.assigneeId || ''}
                    onChange={e => handleUpdate(r.id, 'assigneeId', e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500 text-gray-700"
                  >
                    <option value="">선택 안됨</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                    ))}
                  </select>
                </td>
                <td className="p-0 border-r border-gray-100 last:border-r-0">
                  <input 
                    type="text" 
                    value={r.title} 
                    onChange={e => handleUpdate(r.id, 'title', e.target.value)}
                    placeholder="제목 입력"
                    className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500"
                  />
                </td>
                <td className="p-0 border-r border-gray-100 last:border-r-0 relative">
                  <input 
                    type="text" 
                    value={r.url} 
                    onChange={e => handleUpdate(r.id, 'url', e.target.value)}
                    placeholder="https://"
                    className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500 pr-8"
                  />
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </td>
                <td className="p-0 border-r border-gray-100 last:border-r-0">
                  <input 
                    type="date" 
                    value={r.publishDate} 
                    onChange={e => handleUpdate(r.id, 'publishDate', e.target.value)}
                    className="w-full px-3 py-2 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500"
                  />
                </td>
                <td className="p-0 border-r border-gray-100 last:border-r-0">
                  <input 
                    type="number" 
                    value={r.views || ''} 
                    onChange={e => handleUpdate(r.id, 'views', Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500"
                  />
                </td>
                <td className="p-0 text-center">
                  <button onClick={() => handleDelete(r.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">데이터가 없습니다. 우측 상단의 행 추가를 눌러주세요.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
