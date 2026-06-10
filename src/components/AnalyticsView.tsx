import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Users, UserPlus, FileText, MousePointer, Download, Filter, Plus, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface AnalyticsRecord {
  id: string;
  userId: string;
  name: string; // date string like '2026-05-01'
  visitors: number;
  newUsers: number;
  createdAt: number;
}

export default function AnalyticsView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [records, setRecords] = useState<AnalyticsRecord[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [visitors, setVisitors] = useState('');
  const [newUsers, setNewUsers] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'analyticsRecords'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnalyticsRecord[];
      // sort by date string
      data.sort((a,b) => a.name.localeCompare(b.name));
      setRecords(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'analyticsRecords'));
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !visitors || !newUsers) return;
    const newId = doc(collection(db, 'analyticsRecords')).id;
    try {
      await setDoc(doc(db, 'analyticsRecords', newId), {
        userId: user.uid,
        name: date,
        visitors: Number(visitors),
        newUsers: Number(newUsers),
        createdAt: Date.now()
      });
      setIsAdding(false);
      setVisitors('');
      setNewUsers('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'analyticsRecords');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '이 기록을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'analyticsRecords', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'analyticsRecords');
      }
    }
    });
  };

  const totalVisitors = records.reduce((sum, r) => sum + r.visitors, 0);
  const totalNewUsers = records.reduce((sum, r) => sum + r.newUsers, 0);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-navy-900">데이터 분석</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus className="w-4 h-4" /> 기록 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><Users className="w-5 h-5"/></div>
          </div>
          <p className="text-3xl font-bold text-navy-900">{totalVisitors.toLocaleString()}</p>
          <h3 className="text-sm font-medium text-gray-500 mt-1">총 방문자 수</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-50 text-green-500 rounded-lg"><UserPlus className="w-5 h-5"/></div>
          </div>
          <p className="text-3xl font-bold text-navy-900">{totalNewUsers.toLocaleString()}</p>
          <h3 className="text-sm font-medium text-gray-500 mt-1">총 신규 가입자</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-navy-900 mb-6">사용자 추이 (입력된 날짜별)</h3>
          {records.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={records} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} />
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                  <Area type="monotone" dataKey="visitors" name="방문자" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                  <Area type="monotone" dataKey="newUsers" name="신규 가입자" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-400 text-sm">기록이 없습니다.</div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-navy-900 mb-6">입력 내역</h3>
          <div className="flex-1 overflow-y-auto">
            {records.map(r => (
              <div key={r.id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                <div>
                  <div className="font-medium text-navy-900">{r.name}</div>
                  <div className="text-xs text-gray-500">방문: {r.visitors} | 신규: {r.newUsers}</div>
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-12">기록이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">기록 추가</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input 
                  type="date" required value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">방문자 수</label>
                <input 
                  type="number" required min="0" value={visitors} onChange={e => setVisitors(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">신규 가입자 수</label>
                <input 
                  type="number" required min="0" value={newUsers} onChange={e => setNewUsers(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <button type="submit" className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600">저장하기</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
