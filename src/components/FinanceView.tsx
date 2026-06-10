import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Plus, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';

interface Transaction {
  id: string;
  userId: string;
  type: 'revenue' | 'expense';
  amount: number;
  date: string;
  createdAt: number;
}

export default function FinanceView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form setup
  const [type, setType] = useState<'revenue'|'expense'>('revenue');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      setTransactions(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;
    const newId = doc(collection(db, 'transactions')).id;
    try {
      await setDoc(doc(db, 'transactions', newId), {
        userId: user.uid,
        type,
        amount: Number(amount),
        date,
        createdAt: Date.now()
      });
      setIsAdding(false);
      setAmount('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch(err) {
        handleFirestoreError(err, OperationType.DELETE, 'transactions');
      }
    }
    });
  };

  // Group data by month for the chart. (e.g. '2026-05' -> '5월')
  const monthlyData = transactions.reduce((acc, t) => {
    const monthKey = t.date.substring(0, 7); // yyyy-MM
    if (!acc[monthKey]) acc[monthKey] = { revenue: 0, expenses: 0 };
    if (t.type === 'revenue') acc[monthKey].revenue += t.amount;
    else acc[monthKey].expenses += t.amount;
    return acc;
  }, {} as Record<string, {revenue: number; expenses: number}>);

  const chartData = Object.keys(monthlyData).sort().map(key => ({
    name: parseInt(key.split('-')[1], 10) + '월',
    revenue: monthlyData[key].revenue,
    expenses: monthlyData[key].expenses
  }));

  const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netIncome = totalRevenue - totalExpense;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-navy-900">재무 관리</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus className="w-4 h-4" /> 내역 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">총 수익</h3>
          <p className="text-2xl lg:text-3xl font-bold text-navy-900">₩{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">총 지출</h3>
          <p className="text-2xl lg:text-3xl font-bold text-navy-900">₩{totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">순수익</h3>
          <p className={`text-2xl lg:text-3xl font-bold ${netIncome >= 0 ? 'text-brand-500' : 'text-red-500'}`}>
            {netIncome >= 0 ? '' : '-'}₩{Math.abs(netIncome).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-navy-900 mb-6">수익 및 지출 추이</h3>
          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} width={80} />
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="revenue" name="수익" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenu)" />
                  <Area type="monotone" dataKey="expenses" name="지출" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">데이터가 없습니다.</div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-navy-900 mb-6">내역</h3>
          <div className="flex-1 overflow-y-auto">
            {transactions.sort((a,b) => b.createdAt - a.createdAt).map(t => (
              <div key={t.id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                <div>
                  <div className="font-medium text-navy-900">{t.type === 'revenue' ? '수익' : '지출'}</div>
                  <div className="text-xs text-gray-500">{t.date}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${t.type === 'revenue' ? 'text-green-500' : 'text-red-500'}`}>
                    {t.type === 'revenue' ? '+' : '-'}₩{t.amount.toLocaleString()}
                  </span>
                  <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-12">내역이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">내역 추가</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 bg-white">
                  <option value="revenue">수익</option>
                  <option value="expense">지출</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
                <input 
                  type="number" required min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input 
                  type="date" required value={date} onChange={e => setDate(e.target.value)}
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
