import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { FileSignature, Plus, X, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface Approval {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: string; // 'pending' | 'approved' | 'rejected'
  createdAt: number;
}

export default function ApprovalView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'approvals'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Approval[];
      data.sort((a,b) => b.createdAt - a.createdAt);
      setApprovals(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'approvals'));
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;
    const newId = doc(collection(db, 'approvals')).id;
    try {
      await setDoc(doc(db, 'approvals', newId), {
        userId: user.uid,
        title: title.trim(),
        content: content.trim(),
        status: 'pending',
        createdAt: Date.now()
      });
      setIsAdding(false);
      setTitle('');
      setContent('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'approvals');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'approvals', id), { status });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'approvals');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '기안을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'approvals', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'approvals');
      }
    }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-brand-500" /> 전자결재 (Approval)
        </h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus className="w-4 h-4" /> 기안 작성
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center justify-between">
          <span className="font-semibold text-gray-600">결재 대기</span>
          <span className="text-2xl font-bold text-brand-500">{approvals.filter(a => a.status === 'pending').length}</span>
        </div>
        <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center justify-between">
          <span className="font-semibold text-green-700">결재 완료</span>
          <span className="text-2xl font-bold text-green-600">{approvals.filter(a => a.status === 'approved').length}</span>
        </div>
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center justify-between">
          <span className="font-semibold text-red-700">반려됨</span>
          <span className="text-2xl font-bold text-red-600">{approvals.filter(a => a.status === 'rejected').length}</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">기안일</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500 w-1/2">제목</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">상태</th>
              <th className="py-3 px-4 text-right text-sm">관리</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map(app => (
              <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4 font-medium text-navy-900 text-sm flex-shrink-0">{format(app.createdAt, 'yyyy-MM-dd HH:mm')}</td>
                <td className="py-3 px-4 text-navy-900 font-medium">
                  {app.title}
                  <p className="text-xs text-gray-500 font-normal mt-1 truncate">{app.content}</p>
                </td>
                <td className="py-3 px-4 text-sm">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    app.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    app.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {app.status === 'approved' ? '승인됨' : app.status === 'rejected' ? '반려됨' : '대기중'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button onClick={() => handleStatusChange(app.id, 'approved')} className="p-1 text-green-500 hover:bg-green-50 rounded" title="승인">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleStatusChange(app.id, 'rejected')} className="p-1 text-red-500 hover:bg-red-50 rounded" title="반려">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(app.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {approvals.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">결재 문서가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">기안서 작성</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input 
                  type="text" autoFocus required value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                  placeholder="예: 클라이언트 미팅 관련 비용 청구"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
                <textarea 
                  required value={content} onChange={e => setContent(e.target.value)} rows={5}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 resize-none"
                  placeholder="지출 사유, 예상 항목 등 상세 내용을 적어주세요."
                />
              </div>
              <button type="submit" className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600">결재 상신</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
