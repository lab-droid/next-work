import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Clock, MessageSquare, Paperclip, X, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import { useModal } from '../lib/ModalContext';

interface Task {
  id: string;
  userId: string;
  projectId?: string;
  assigneeId?: string;
  title: string;
  content: string;
  tag: string;
  tagColor: string;
  status: string; // 'todo', 'inProgress', 'feedback', 'done', 'hold'
  createdAt: number;
}

const COLUMNS = [
  { id: 'todo', title: '요청' },
  { id: 'inProgress', title: '진행' },
  { id: 'feedback', title: '피드백' },
  { id: 'done', title: '완료' },
  { id: 'hold', title: '보류' }
];

export default function KanbanBoard({ projectId, embedded }: { projectId?: string, embedded?: boolean }) {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  // bg-brand-500 hover:text-white transition-all text-sm font-semibold flex items-center justify-center gap-2 group
  const [isAdding, setIsAdding] = useState<string | null>(null); // column id
  
  // New task form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'users')), (snapshot) => {
       const u = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       setUsers(u);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let unsubTasks: any = null;
    let unsubUser = onSnapshot(doc(db, 'users', user.uid), (docInfo) => {
       if (docInfo.exists()) {
           const userData = docInfo.data();
           const code = userData.companyCode;
           let q = query(collection(db, 'tasks'));
           if (unsubTasks) unsubTasks(); // unsubscribe previous if exists
           unsubTasks = onSnapshot(q, (snapshot) => {
             let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
             if (projectId) {
               data = data.filter(d => (d as any).projectId === projectId);
             } else {
               data = data.filter(d => !(d as any).projectId);
             }
             data.sort((a,b) => b.createdAt - a.createdAt);
             setTasks(data);
           }, error => handleFirestoreError(error, OperationType.LIST, 'tasks'));
       }
    });

    return () => {
       unsubUser();
       if (unsubTasks) unsubTasks();
    };
  }, [user, projectId]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    // We only update status. 
    try {
      await updateDoc(doc(db, 'tasks', draggableId), {
        status: destination.droppableId
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'tasks');
    }
  };

  const handleAddTask = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim() || !tag.trim()) return;
    const newId = doc(collection(db, 'tasks')).id;
    try {
      await setDoc(doc(db, 'tasks', newId), {
        userId: user.uid,
        projectId: projectId || null,
        assigneeId: assigneeId || user.uid,
        title: title.trim(),
        content: content.trim(),
        tag: tag.trim(),
        tagColor: 'text-blue-600 bg-blue-50 border-blue-100', // default style
        status,
        createdAt: Date.now()
      });
      setIsAdding(null);
      setTitle('');
      setContent('');
      setTag('');
      setAssigneeId('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '작업을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'tasks');
      }
    }
    });
  };

  return (
    <div className={`h-full flex flex-col ${embedded ? '' : 'pt-2'} pb-6`}>
      {!embedded && (
        <div className="flex justify-between items-center mb-6 px-1">
          <h2 className="text-2xl font-bold text-navy-900">프로젝트 보드</h2>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4 h-full items-start kanban-scroll">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="w-80 flex-shrink-0 flex flex-col bg-gray-50/50 rounded-2xl h-full border border-gray-100">
                <div className="p-4 flex justify-between items-center bg-white/50 border-b border-gray-100 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-navy-900">{col.title}</h3>
                    <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 p-3 overflow-y-auto min-h-[150px] transition-colors rounded-b-2xl",
                        snapshot.isDraggingOver ? "bg-brand-50/50" : ""
                      )}
                    >
                      <div className="space-y-3">
                        {colTasks.map((task, index) => (
                           // @ts-expect-error React 19 type mismatch
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "bg-white p-4 rounded-xl shadow-sm border transition-shadow",
                                  snapshot.isDragging ? "shadow-md border-brand-200 rotate-2" : "border-gray-200 hover:border-gray-300"
                                )}
                                style={{ ...provided.draggableProps.style }}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border tracking-wide uppercase", task.tagColor)}>
                                    {task.tag}
                                  </span>
                                  <button onClick={() => handleDelete(task.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <h4 className="font-bold text-navy-900 mb-1">{task.title || '-'}</h4>
                                <p className="text-xs text-gray-500 mb-4 line-clamp-2">{task.content}</p>
                                <div className="flex justify-between items-center text-gray-500">
                                   <div className="flex -space-x-1">
                                      {task.assigneeId && users.find(u => u.id === task.assigneeId) && (
                                         <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs border border-white font-bold" title={users.find(u => u.id === task.assigneeId)?.displayName || '담당자'}>
                                           {(users.find(u => u.id === task.assigneeId)?.displayName || 'U').charAt(0)}
                                         </div>
                                      )}
                                   </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>

                      {isAdding === col.id ? (
                        <form onSubmit={e => handleAddTask(e, col.id)} className="mt-4 bg-white p-3 rounded-xl border border-brand-200">
                           <input type="text" autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" className="w-full text-sm font-bold outline-none mb-2"/>
                           <textarea required value={content} onChange={e => setContent(e.target.value)} placeholder="작업 내용" className="w-full text-xs text-gray-600 outline-none mb-2 resize-none h-16"/>
                           <input type="text" required value={tag} onChange={e => setTag(e.target.value)} placeholder="태그 (예: 기획)" className="w-full text-sm outline-none mb-2"/>
                           <select 
                             value={assigneeId} 
                             onChange={e => setAssigneeId(e.target.value)} 
                             className="w-full text-sm outline-none mb-3 bg-gray-50 rounded px-2 py-1 text-gray-600"
                           >
                              <option value="">담당자 선택 (기본: 본인)</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.displayName || '이름 없음'}</option>
                              ))}
                           </select>
                           <div className="flex gap-2 justify-end">
                             <button type="button" onClick={() => { setIsAdding(null); setTitle(''); setContent(''); setTag(''); setAssigneeId(''); }} className="px-2 py-1 text-gray-500 text-xs hover:text-navy-900 bg-gray-100 rounded">취소</button>
                             <button type="submit" className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs">저장</button>
                           </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => { setIsAdding(col.id); setTitle(''); setContent(''); setTag(''); setAssigneeId(''); }}
                          className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-navy-900 hover:border-gray-400 hover:bg-gray-100/50 transition-all text-sm font-semibold flex items-center justify-center gap-2 group"
                        >
                          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span>작업 추가</span>
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
