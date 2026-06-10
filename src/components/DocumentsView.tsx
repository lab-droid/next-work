import React, { useState, useEffect } from 'react';
import { Search, Folder, FileText, Image as ImageIcon, MoreVertical, Upload, Plus, X, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface DocumentModel {
  id: string;
  userId: string;
  name: string;
  type: string;
  size: string;
  createdAt: number;
}

export default function DocumentsView({ projectId, embedded }: { projectId?: string, embedded?: boolean }) {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');

  useEffect(() => {
    if (!user) return;
    let q = query(collection(db, 'documents'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DocumentModel[];
      if (projectId) {
        data = data.filter(d => (d as any).projectId === projectId);
      } else {
        data = data.filter(d => !(d as any).projectId);
      }
      data.sort((a, b) => b.createdAt - a.createdAt);
      setDocuments(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'documents'));
    return () => unsubscribe();
  }, [user]);

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDocName.trim()) return;
    const newId = doc(collection(db, 'documents')).id;
    try {
      await setDoc(doc(db, 'documents', newId), {
        userId: user.uid,
        projectId: projectId || null,
        name: newDocName.trim(),
        type: newDocName.includes('.') ? newDocName.split('.').pop()!.toLowerCase() : 'txt',
        size: '1.0 MB', // mock size
        createdAt: Date.now()
      });
      setNewDocName('');
      setIsAddingDoc(false);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'documents');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '문서를 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'documents', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'documents');
      }
    }
    });
  };

  const filteredDocs = documents.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`bg-white rounded-2xl ${embedded ? 'border-none shadow-none h-full' : 'border border-gray-100 p-6 shadow-sm min-h-[600px]'} flex flex-col`}>
      {!embedded && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-navy-900">문서 관리 (Drive)</h2>
          
          <div className="flex w-full md:w-auto gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="문서 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsAddingDoc(true)}
              className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              업로드
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="문서 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>
          <button onClick={() => setIsAddingDoc(true)} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors">
            <Upload className="w-4 h-4" /> 문서 추가
          </button>
        </div>
      )}

      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-500 mb-4">최근 문서</h3>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="py-3 px-4 text-sm text-gray-500 font-medium">이름</th>
                <th className="py-3 px-4 text-sm text-gray-500 font-medium w-32">크기</th>
                <th className="py-3 px-4 text-sm text-gray-500 font-medium w-32">등록일</th>
                <th className="py-3 px-4 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${['png','jpg','jpeg','gif'].includes(doc.type) ? 'bg-purple-50 text-purple-500' : doc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                        {['png','jpg','jpeg','gif'].includes(doc.type) ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <span className="font-medium text-navy-900 text-sm">{doc.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm">{doc.size}</td>
                  <td className="py-3 px-4 text-gray-500 text-sm">{format(doc.createdAt, 'yyyy-MM-dd')}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleDelete(doc.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                    문서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">문서 업로드 (가상)</h3>
              <button onClick={() => setIsAddingDoc(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddDoc}>
              <input 
                type="text" 
                autoFocus required
                value={newDocName} 
                onChange={e => setNewDocName(e.target.value)}
                placeholder="파일명 (예: 기획서.pdf)"
                className="w-full border-gray-200 rounded-xl px-4 py-2 mb-4 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button type="submit" className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600">업로드</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
