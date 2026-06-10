import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Plus, Trash2, Edit2, X, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface Notice {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
}

export default function NoticeView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notices'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notice[];
      data.sort((a,b) => b.createdAt - a.createdAt);
      setNotices(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'notices'));
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;
    const newId = doc(collection(db, 'notices')).id;
    try {
      await setDoc(doc(db, 'notices', newId), {
        userId: user.uid,
        title: title.trim(),
        content: content.trim(),
        createdAt: Date.now()
      });
      setIsAdding(false);
      setTitle('');
      setContent('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'notices');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '공지사항을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'notices', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'notices');
      }
    }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand-500" /> 공지사항
        </h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus className="w-4 h-4" /> 새 공지 작성
        </button>
      </div>

      <div className="space-y-4">
        {notices.map(notice => (
          <div key={notice.id} className="p-4 border border-gray-100 rounded-xl hover:border-brand-200 transition-colors bg-gray-50/50">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-navy-900 text-lg">{notice.title}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{format(notice.createdAt, 'yyyy-MM-dd')}</span>
                <button onClick={() => handleDelete(notice.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap text-sm">{notice.content}</p>
          </div>
        ))}
        {notices.length === 0 && (
          <div className="text-center text-gray-500 py-12">등록된 공지사항이 없습니다.</div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">새 공지사항 작성</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input 
                  type="text" autoFocus required value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea 
                  required value={content} onChange={e => setContent(e.target.value)} rows={5}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 resize-none"
                />
              </div>
              <button type="submit" className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600">등록하기</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
