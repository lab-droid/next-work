import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useModal } from '../lib/ModalContext';

interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  type: string;
  createdAt: number;
}

export default function CalendarView({ projectId, embedded }: { projectId?: string, embedded?: boolean }) {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('meeting');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CalendarEvent[];
      if (projectId) {
        eventsData = eventsData.filter(d => (d as any).projectId === projectId);
      } else {
        eventsData = eventsData.filter(d => !(d as any).projectId);
      }
      setEvents(eventsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });
    return () => unsubscribe();
  }, [user]);

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900">
          {format(currentMonth, 'yyyy년 MM월')}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    let startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-medium text-sm text-gray-500 py-2">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2 border-b border-gray-100">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';
    
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const formattedFullDate = format(cloneDay, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.date === formattedFullDate);
        
        days.push(
          <div 
            key={day.toString()} 
            className={`min-h-[100px] border border-gray-100 p-2 cursor-pointer transition-colors
              ${!isSameMonth(day, monthStart) ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-blue-50'}
              ${isSameDay(day, selectedDate) ? 'ring-2 ring-brand-500 z-10 relative' : ''}
            `}
            onClick={() => {
              setSelectedDate(cloneDay);
              setIsModalOpen(true);
            }}
          >
            <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-brand-500 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
              {formattedDate}
            </span>
            <div className="mt-1 space-y-1">
              {dayEvents.map(evt => (
                <div 
                  key={evt.id} 
                  className={`text-xs p-1 px-2 rounded-md truncate ${
                    evt.type === 'meeting' ? 'bg-blue-100 text-blue-700' : 
                    evt.type === 'deadline' ? 'bg-red-100 text-red-700' : 
                    'bg-green-100 text-green-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEvent(evt.id);
                  }}
                  title="클릭하여 삭제"
                >
                  {evt.title}
                </div>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEventTitle.trim()) return;
    
    const newId = doc(collection(db, 'events')).id;
    try {
      await setDoc(doc(db, 'events', newId), {
        userId: user.uid,
        projectId: projectId || null,
        title: newEventTitle,
        date: format(selectedDate, 'yyyy-MM-dd'),
        type: newEventType,
        createdAt: Date.now()
      });
      setNewEventTitle('');
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    confirm({
      title: '확인',
      message: '일정을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'events', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'events');
      }
    }
    });
  };

  return (
    <div className={`bg-white rounded-2xl ${embedded ? 'border-none shadow-none p-2' : 'border border-gray-100 p-6 shadow-sm'}`}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">일정 추가</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {format(selectedDate, 'yyyy년 MM월 dd일')}
            </p>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">일정 내용</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none border"
                  placeholder="회의, 마감일 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none border bg-white"
                >
                  <option value="meeting">회의</option>
                  <option value="deadline">마감일</option>
                  <option value="reminder">리마인더</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  className="bg-brand-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-brand-600 transition-colors"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
