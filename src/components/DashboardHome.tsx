import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Clock, CheckCircle2, Circle, MoreHorizontal, ArrowUpRight, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useModal } from '../lib/ModalContext';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: number;
}

export default function DashboardHome() {
  const { confirm, alert } = useModal();
  const { user, userProfile } = useAuth();
  
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const [newTodo, setNewTodo] = useState('');
  
  const [clockState, setClockState] = useState<'out' | 'in'>('out');
  const [clockTime, setClockTime] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to User doc for clock state
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.clockState === 'in' || data.clockState === 'out') {
          setClockState(data.clockState);
        }
        if (data.clockTime !== undefined) {
          setClockTime(data.clockTime);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const todosRef = collection(db, 'todos');
    const q = query(todosRef, where('userId', '==', user.uid));
    
    const unsubscribeTodos = onSnapshot(q, (snapshot) => {
      const todosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Todo[];
      // Sort by createdAt descending
      todosData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTodos(todosData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'todos');
    });

    return () => {
      unsubscribeUser();
      unsubscribeTodos();
    };
  }, [user]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || !user) return;
    
    const todoId = Date.now().toString();
    try {
      await setDoc(doc(db, 'todos', todoId), {
        text: newTodo,
        completed: false,
        userId: user.uid,
        createdAt: Date.now()
      });
      setNewTodo('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'todos');
    }
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'todos', id), {
        completed: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'todos');
    }
  };

  const removeTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'todos');
    }
  };

  const handleClockToggle = async () => {
    if (!user) return;
    
    const newState = clockState === 'out' ? 'in' : 'out';
    const newTime = newState === 'in' ? format(new Date(), 'HH:mm') : null;
    
    setClockState(newState);
    setClockTime(newTime);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        clockState: newState,
        clockTime: newTime
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-10">
      {/* Left Column: Greeting & Summary */}
      <div className="md:col-span-2 space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4 w-64 h-64 bg-brand-500 rounded-full blur-3xl"></div>
          
          <div>
            <p className="text-gray-500 mb-2 font-medium">{format(new Date(), 'yyyy년 MM월 dd일 (EEE)')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">안녕하세요, {(userProfile?.name || user?.displayName || '사용자').split(' ')[0]}님! 👋</h2>
            <p className="text-navy-700">오늘 할 일이 {todos.filter(t => !t.completed).length}개 남았습니다. 활기찬 하루 되세요!</p>
          </div>
          
          <div className="flex gap-4 shrink-0">
            <div className="bg-brand-50 w-24 h-24 rounded-2xl flex flex-col items-center justify-center border border-brand-100">
              <span className="text-3xl font-bold text-brand-600 mb-1">{todos.filter(t => !t.completed).length}</span>
              <span className="text-xs font-semibold text-brand-600/80">진행중</span>
            </div>
            <div className="bg-green-50 w-24 h-24 rounded-2xl flex flex-col items-center justify-center border border-green-100">
              <span className="text-3xl font-bold text-green-600 mb-1">{todos.filter(t => t.completed).length}</span>
              <span className="text-xs font-semibold text-green-600/80">완료됨</span>
            </div>
          </div>
        </div>

        {/* Recent Activity / Widgets */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-navy-900">최근 프로젝트</h3>
              <button className="text-sm text-brand-500 hover:text-brand-600 font-medium">전체보기</button>
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="group p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${i === 1 ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-navy-900 group-hover:text-brand-600 transition-colors">
                        {i === 1 ? '웹사이트 리뉴얼' : '모바일 앱 V2 기획'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">업데이트: 2시간 전</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-brand-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-navy-900 mb-6">다가오는 일정</h3>
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-gray-100">
              <div className="relative pl-6">
                <div className="absolute left-1 top-1.5 w-2 h-2 rounded-full bg-brand-500 ring-4 ring-white"></div>
                <p className="text-xs font-bold text-brand-500 mb-1">14:00 - 15:30</p>
                <p className="text-sm font-semibold text-navy-900">주간 스프린트 플래닝</p>
                <p className="text-xs text-gray-500 mt-1">회의실 A / 화상회의</p>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-1 top-1.5 w-2 h-2 rounded-full bg-gray-300 ring-4 ring-white"></div>
                <p className="text-xs font-bold text-gray-500 mb-1">16:00 - 17:00</p>
                <p className="text-sm font-semibold text-navy-900">클라이언트 피드백 리뷰</p>
                <p className="text-xs text-gray-500 mt-1">김수진 UI 디자이너</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Clock & Tasks */}
      <div className="space-y-6">
        {/* Clock In Widget */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-navy-900">출퇴근 기록</h3>
              {clockState === 'in' && clockTime && (
                <p className="text-sm text-gray-500 mt-1">출근시간 <span className="font-bold text-navy-800">{clockTime}</span></p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleClockToggle}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-sm ${
              clockState === 'in' 
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                : 'bg-navy-900 text-white hover:bg-navy-800'
            }`}
          >
            {clockState === 'in' ? '퇴근하기' : '출근하기'}
          </motion.button>
        </div>

        {/* To-Do List Widget */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px] flex flex-col">
          <h3 className="font-bold text-navy-900 mb-6">오늘의 할 일</h3>
          
          <form onSubmit={handleAddTodo} className="relative mb-6">
            <input 
              type="text" 
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="새로운 할 일을 입력하세요" 
              className="w-full bg-gray-50 border-none rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <button 
              type="submit"
              disabled={!newTodo.trim()}
              className="absolute right-12 top-1.5 bottom-1.5 aspect-square bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:text-brand-500 hover:border-brand-200 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {todos.map(todo => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={todo.id} 
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors ${todo.completed ? 'bg-gray-50 border-transparent' : 'bg-white border-gray-100 hover:border-brand-200'}`}
              >
                <button 
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                  type="button"
                  className="mt-0.5 flex-shrink-0"
                >
                  {todo.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 hover:text-brand-400 shrink-0" />
                  )}
                </button>
                <span className={`text-sm flex-1 break-all ${todo.completed ? 'text-gray-400 line-through' : 'text-navy-900'}`}>{todo.text}</span>
                <button 
                  onClick={() => removeTodo(todo.id)}
                  type="button"
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity p-1"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
            {todos.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <CheckCircle2 className="w-10 h-10 mb-2 opacity-50 text-gray-300" />
                <p className="text-sm">모든 할 일을 마쳤습니다!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
