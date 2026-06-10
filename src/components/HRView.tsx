import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Clock, Play, Square, CheckCircle, Plus, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string; // '근무중', '퇴근', '지각', '결근'
  createdAt: number;
}

export default function HRView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [records, setRecords] = useState<Attendance[]>([]);
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const [isAdding, setIsAdding] = useState(false);
  const [manualDate, setManualDate] = useState(todayDateStr);
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'attendances'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];
      data.sort((a,b) => b.date.localeCompare(a.date));
      setRecords(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'attendances'));
    return () => unsubscribe();
  }, [user]);

  const handleCheckIn = async () => {
    if (!user) return;
    const existing = records.find(r => r.date === todayDateStr);
    if(existing) {
      alert({ title: "알림", message: '이미 오늘의 출근 기록이 있습니다.' });
      return;
    }
    const newId = doc(collection(db, 'attendances')).id;
    try {
      await setDoc(doc(db, 'attendances', newId), {
        userId: user.uid,
        date: todayDateStr,
        checkIn: format(new Date(), 'HH:mm:ss'),
        checkOut: '',
        status: '근무중',
        createdAt: Date.now()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendances');
    }
  };

  const handleCheckOut = async () => {
    if (!user) return;
    const existing = records.find(r => r.date === todayDateStr);
    if(!existing) {
      alert({ title: "알림", message: '출근 기록이 없습니다.' });
      return;
    }
    if(existing.checkOut) {
      alert({ title: "알림", message: '이미 퇴근 처리가 되었습니다.' });
      return;
    }
    try {
      await updateDoc(doc(db, 'attendances', existing.id), {
        checkOut: format(new Date(), 'HH:mm:ss'),
        status: '퇴근'
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendances');
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !manualDate || !manualCheckIn) return;
    const newId = doc(collection(db, 'attendances')).id;
    try {
      await setDoc(doc(db, 'attendances', newId), {
        userId: user.uid,
        date: manualDate,
        checkIn: manualCheckIn,
        checkOut: manualCheckOut,
        status: manualCheckOut ? '퇴근' : '근무중',
        createdAt: Date.now()
      });
      setIsAdding(false);
      setManualCheckIn('');
      setManualCheckOut('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendances');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '이 근태 기록을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'attendances', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'attendances');
      }
    }
    });
  };

  const todayRecord = records.find(r => r.date === todayDateStr);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-500" /> 근태 관리 (HR)
        </h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
          <Plus className="w-4 h-4" /> 수동 등록
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 border border-brand-100 bg-brand-50/30 rounded-2xl flex flex-col justify-center items-center">
          <p className="text-gray-500 font-medium mb-2">{todayDateStr}</p>
          <div className="flex gap-4">
            <button 
              onClick={handleCheckIn}
              disabled={!!todayRecord}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${todayRecord ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 shadow-sm'}`}
            >
              <Play className="w-5 h-5" /> 출근하기
            </button>
            <button 
              onClick={handleCheckOut}
              disabled={!todayRecord || !!todayRecord?.checkOut}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${(!todayRecord || !!todayRecord.checkOut) ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 shadow-sm'}`}
            >
              <Square className="w-5 h-5 fill-current" /> 퇴근하기
            </button>
          </div>
        </div>

        <div className="p-6 border border-gray-100 bg-white shadow-sm rounded-2xl flex flex-col justify-center">
          <h3 className="font-bold text-navy-900 mb-4">현재 상태</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">출근 시간</span>
              <span className="font-medium">{todayRecord ? todayRecord.checkIn : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">퇴근 시간</span>
              <span className="font-medium">{todayRecord?.checkOut || '-'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-gray-500">상태</span>
              {todayRecord ? (
                <span className={`px-2 py-1 rounded-md text-xs font-bold ${todayRecord.status === '근무중' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {todayRecord.status}
                </span>
              ) : (
                <span className="text-gray-400 text-sm">미출근</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <h3 className="font-bold text-navy-900 mb-4 px-1">근태 내역</h3>
      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">날짜</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">출근</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">퇴근</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">상태</th>
              <th className="py-3 px-4 text-right text-sm"></th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4 font-medium text-navy-900">{record.date}</td>
                <td className="py-3 px-4 text-gray-600 text-sm">{record.checkIn}</td>
                <td className="py-3 px-4 text-gray-600 text-sm">{record.checkOut || '-'}</td>
                <td className="py-3 px-4 text-sm">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${record.status === '근무중' ? 'bg-green-100 text-green-700' : record.status === '지각' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                    {record.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => handleDelete(record.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">기록이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">수동 등록</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleManualAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input 
                  type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">출근 시간</label>
                <input 
                  type="time" step="1" required value={manualCheckIn} onChange={e => setManualCheckIn(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">퇴근 시간 (선택)</label>
                <input 
                  type="time" step="1" value={manualCheckOut} onChange={e => setManualCheckOut(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
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
