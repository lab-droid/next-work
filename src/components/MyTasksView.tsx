import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { format } from 'date-fns';
import { CheckSquare, Clock, AlignLeft, Trash2, Plus, MoreVertical } from 'lucide-react';
import { useModal } from '../lib/ModalContext';
import { cn } from '../lib/utils';

interface Task {
  id: string;
  userId: string;
  projectId?: string;
  assigneeId?: string;
  title?: string;
  content: string;
  tag: string;
  tagColor: string;
  status: string; // 'todo', 'inProgress', 'review', 'done'
  createdAt: number;
}

const STATUS_OPTIONS = [
  { id: 'todo', label: '할 일', color: 'bg-gray-100 text-gray-700' },
  { id: 'inProgress', label: '진행 중', color: 'bg-blue-100 text-blue-700' },
  { id: 'review', label: '리뷰 중', color: 'bg-orange-100 text-orange-700' },
  { id: 'done', label: '완료', color: 'bg-green-100 text-green-700' }
];

export default function MyTasksView({ projectId, embedded }: { projectId?: string, embedded?: boolean }) {
  const { user } = useAuth();
  const { confirm, alert } = useModal();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Create state
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), docInfo => {
      if (docInfo.exists()) {
        const data = docInfo.data();
        const code = data.companyCode || data.companyId || null;
        if (code === undefined) return; // Prevent undefined error
        const pq = query(collection(db, 'projects'), where('companyCode', '==', code));
        onSnapshot(pq, snap => {
          setProjects(snap.docs.map(d => ({id: d.id, ...d.data()})));
        }, err => console.log('projects load err', err));
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'tasks'),
      where('assigneeId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      if (projectId) {
        data = data.filter(d => d.projectId === projectId);
      } else {
        data = data.filter(d => !!d.projectId); // Only show tasks that belong to a project
      }
      data.sort((a, b) => b.createdAt - a.createdAt);
      setTasks(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [user]);

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'tasks');
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: '삭제 확인',
      message: '이 업무를 삭제하시겠습니까?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tasks', id));
        } catch(err) {
          handleFirestoreError(err, OperationType.DELETE, 'tasks');
        }
      }
    });
  };

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'inProgress').length;
  const feedbackCount = tasks.filter(t => t.status === 'feedback').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const holdCount = tasks.filter(t => t.status === 'hold').length;

  const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  return (
    <div className={`bg-white rounded-2xl ${embedded ? 'border-none shadow-none h-full' : 'border border-gray-100 shadow-sm p-6 min-h-[650px]'}`}>
      {!embedded && (
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-navy-900 mb-1">내 업무</h2>
            <p className="text-sm text-gray-500">배정된 모든 업무의 현황을 파악하고 관리하세요.</p>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-navy-900">프로젝트 할일</h3>
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div 
          onClick={() => setFilterStatus('todo')}
          className={cn("p-4 rounded-xl border transition-all cursor-pointer", filterStatus === 'todo' ? "border-gray-400 bg-gray-50" : "border-gray-100 hover:border-gray-300")}
        >
          <p className="text-sm font-medium text-gray-500 mb-1">요청</p>
          <p className="text-2xl font-bold text-gray-800">{todoCount}</p>
        </div>
        <div 
          onClick={() => setFilterStatus('inProgress')}
          className={cn("p-4 rounded-xl border transition-all cursor-pointer", filterStatus === 'inProgress' ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-300")}
        >
          <p className="text-sm font-medium text-gray-500 mb-1">진행</p>
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
        </div>
        <div 
          onClick={() => setFilterStatus('feedback')}
          className={cn("p-4 rounded-xl border transition-all cursor-pointer", filterStatus === 'feedback' ? "border-orange-400 bg-orange-50" : "border-gray-100 hover:border-gray-300")}
        >
          <p className="text-sm font-medium text-gray-500 mb-1">피드백</p>
          <p className="text-2xl font-bold text-orange-600">{feedbackCount}</p>
        </div>
        <div 
          onClick={() => setFilterStatus('done')}
          className={cn("p-4 rounded-xl border transition-all cursor-pointer", filterStatus === 'done' ? "border-green-400 bg-green-50" : "border-gray-100 hover:border-gray-300")}
        >
          <p className="text-sm font-medium text-gray-500 mb-1">완료</p>
          <p className="text-2xl font-bold text-green-600">{doneCount}</p>
        </div>
        <div 
          onClick={() => setFilterStatus('hold')}
          className={cn("p-4 rounded-xl border transition-all cursor-pointer", filterStatus === 'hold' ? "border-red-400 bg-red-50" : "border-gray-100 hover:border-gray-300")}
        >
          <p className="text-sm font-medium text-gray-500 mb-1">보류</p>
          <p className="text-2xl font-bold text-red-600">{holdCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button 
          onClick={() => setFilterStatus('all')}
          className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", filterStatus === 'all' ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
        >
          전체 보기
        </button>
        {filterStatus !== 'all' && (
          <span className="text-sm text-brand-600 font-medium">
            현재 <b>{STATUS_OPTIONS.find(s => s.id === filterStatus)?.label}</b> 상태의 업무만 보고 있습니다.
          </span>
        )}
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>해당하는 업무가 없습니다.</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const currentStatus = STATUS_OPTIONS.find(s => s.id === task.status);
            return (
              <div key={task.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all gap-4">
                <div className="flex items-start gap-3 flex-1 w-full relative group">
                  <div className="mt-1">
                    <CheckSquare className={cn("w-5 h-5", task.status === 'done' ? "text-green-500" : "text-gray-300")} />
                  </div>
                  <div>
                    <h4 className={cn("font-medium text-navy-900", task.status === 'done' && "line-through text-gray-400")}>
                      {task.title || task.content}
                    </h4>
                    {task.title && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.content}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                      {task.projectId && (
                        <span className="px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase rounded-md border text-brand-600 bg-brand-50 border-brand-100 truncate max-w-[150px]" title="프로젝트">
                          {projects.find(p => p.id === task.projectId)?.name || '연결된 프로젝트'}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase rounded-md border text-blue-600 bg-blue-50 border-blue-100 truncate max-w-[120px]">
                        {task.tag}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {format(task.createdAt, 'MM.dd HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={task.status}
                    onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                    className={cn(
                      "flex-1 sm:w-32 px-3 py-1.5 text-sm font-medium rounded-lg outline-none appearance-none border cursor-pointer text-center",
                      currentStatus?.color || "bg-gray-100 text-gray-700"
                    )}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
