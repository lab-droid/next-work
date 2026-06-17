import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useModal } from '../lib/ModalContext';
import { Plus, Folder, Trash2, X, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  companyCode: string;
  assigneeIds?: string[];
  startDate?: string;
  endDate?: string;
  createdAt: number;
}

export default function ProjectListView({ onSelectProject, companyCode }: { onSelectProject: (p: Project) => void, companyCode: string }) {
  const { user } = useAuth();
  const { confirm, alert } = useModal();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'users')), (snapshot) => {
       setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!companyCode) return;
    const q = query(collection(db, 'projects'), where('companyCode', '==', companyCode));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      data.sort((a, b) => b.createdAt - a.createdAt);
      setProjects(data);
    }, err => handleFirestoreError(err, OperationType.LIST, 'projects'));
    return () => unsubscribe();
  }, [companyCode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const newId = doc(collection(db, 'projects')).id;
    try {
      await setDoc(doc(db, 'projects', newId), {
        name: newProjectName.trim(),
        companyCode,
        assigneeIds,
        startDate,
        endDate,
        createdAt: Date.now()
      });
      setNewProjectName('');
      setStartDate('');
      setEndDate('');
      setAssigneeIds([]);
      setIsAdding(false);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'projects');
    }
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    confirm({
      title: '삭제 확인',
      message: '이 프로젝트를 삭제하시겠습니까? 관련된 데이터는 자동으로 삭제되지 않습니다.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'projects', id));
        } catch(err) {
          handleFirestoreError(err, OperationType.DELETE, 'projects');
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm min-h-[600px]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-navy-900">내부 프로젝트 목록</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition"
        >
          <Plus className="w-5 h-5" />
          프로젝트 생성
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => onSelectProject(p)}
            className="group p-5 bg-gray-50 border border-gray-100 rounded-2xl hover:border-brand-500 hover:shadow-md transition-all cursor-pointer flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
               <div className="w-10 h-10 bg-brand-100 text-brand-500 rounded-xl flex items-center justify-center">
                 <Folder className="w-5 h-5" />
               </div>
               <button onClick={(e) => handleDelete(p.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
            <h3 className="font-bold text-navy-900 mb-1">{p.name}</h3>
            {(p.startDate || p.endDate) && (
              <div className="text-[11px] text-gray-500 mb-2">
                {p.startDate ? p.startDate.replace(/-/g, '.') : ''} ~ {p.endDate ? p.endDate.replace(/-/g, '.') : ''}
              </div>
            )}
            {p.assigneeIds && Array.isArray(p.assigneeIds) && p.assigneeIds.length > 0 && (
              <div className="flex -space-x-1 mb-2">
                {p.assigneeIds.slice(0, 3).map(uid => (
                  <div key={uid} className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[9px] border border-white font-bold" title={users.find(u => u.id === uid)?.name || users.find(u => u.id === uid)?.displayName || '담당자'}>
                    {(users.find(u => u.id === uid)?.name || users.find(u => u.id === uid)?.displayName || 'U').charAt(0)}
                  </div>
                ))}
                {p.assigneeIds.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[9px] border border-white font-bold">
                    +{p.assigneeIds.length - 3}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-auto pt-4 flex justify-between items-center">
               <span>{format(p.createdAt, 'yyyy.MM.dd')} 생성</span>
               <ArrowRight className="w-4 h-4 text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        ))}
      </div>

      {projects.length === 0 && !isAdding && (
        <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mt-4">
          <Folder className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="font-medium text-gray-600">생성된 프로젝트가 없습니다.</p>
          <p className="text-sm mt-1">상단의 버튼을 눌러 새 내부 프로젝트를 만들어보세요.</p>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">새 프로젝트 생성</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="max-h-[60vh] overflow-y-auto px-1 py-1 no-scrollbar mb-4">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">프로젝트 이름</label>
                  <input 
                    type="text" 
                    autoFocus required
                    value={newProjectName} 
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="프로젝트 이름 입력"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">시작일</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">마감일</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">담당자 (다중 선택 가능)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={assigneeIds.includes(u.id)} onChange={() => toggleAssignee(u.id)} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                        <span className="text-sm">{u.name || u.displayName || u.email || '이름 없음'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition">생성하기</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
