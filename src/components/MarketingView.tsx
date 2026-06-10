import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Target, Users, LayoutList, BarChart3, Edit3, Eye } from 'lucide-react';
import BlogSpreadsheet from './BlogSpreadsheet';

interface Customer {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  campaignId?: string | null;
  createdAt: number;
}

interface BlogResult {
  id: string;
  userId: string;
  customerId: string;
  assigneeId?: string | null;
  title: string;
  url: string;
  publishDate: string;
  views: number;
  createdAt: number;
}

export default function MarketingView() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allResults, setAllResults] = useState<BlogResult[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [marketingType, setMarketingType] = useState<string>('blog');

  useEffect(() => {
    if (!user) return;
    
    // Fetch customers
    const customersQuery = query(collection(db, 'customers'), where('userId', '==', user.uid));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      data.sort((a,b) => b.createdAt - a.createdAt);
      setCustomers(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'customers'));

    // Fetch all blog results for dashboard
    const resultsQuery = query(collection(db, 'blogResults'), where('userId', '==', user.uid));
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BlogResult[];
      setAllResults(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'blogResults'));


    return () => {
      unsubscribeCustomers();
      unsubscribeResults();
    };
  }, [user]);

  // Dashboard Stats
  const activeCustomersCount = new Set(allResults.map(r => r.customerId)).size;
  const totalPostsCount = allResults.filter(r => r.url.trim() !== '').length;
  const totalViewsCount = allResults.reduce((acc, r) => acc + (r.views || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-500" /> 마케팅 관리
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border border-brand-100 bg-brand-50/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-brand-100 text-brand-600 rounded-lg">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">진행 중인 고객사</p>
            <p className="text-2xl font-bold text-navy-900">{activeCustomersCount}개사</p>
          </div>
        </div>
        <div className="p-4 border border-blue-100 bg-blue-50/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">누적 포스팅 (블로그)</p>
            <p className="text-2xl font-bold text-navy-900">{totalPostsCount}건</p>
          </div>
        </div>
        <div className="p-4 border border-orange-100 bg-orange-50/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">총 조회수 (블로그)</p>
            <p className="text-2xl font-bold text-navy-900">{totalViewsCount.toLocaleString()}회</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-bold text-navy-900 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-500" /> 고객사 선택 (CRM)
            </label>
            <select 
              value={selectedCustomerId} 
              onChange={e => setSelectedCustomerId(e.target.value)} 
              className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">-- 고객사를 선택해주세요 --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
              ))}
            </select>
          </div>
          
          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-bold text-navy-900 mb-2 flex items-center gap-1.5">
              <LayoutList className="w-4 h-4 text-brand-500" /> 마케팅 종류
            </label>
            <select 
              value={marketingType} 
              onChange={e => setMarketingType(e.target.value)} 
              className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="blog">블로그</option>
              <option value="instagram" disabled>인스타그램 (준비중)</option>
              <option value="youtube" disabled>유튜브 (준비중)</option>
              <option value="other" disabled>기타 (준비중)</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        {selectedCustomerId && marketingType === 'blog' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <BlogSpreadsheet customerId={selectedCustomerId} />
          </div>
        ) : selectedCustomerId ? (
          <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            선택하신 마케팅 종류는 아직 준비 중입니다. (블로그 유형만 활성화됨)
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Target className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-navy-900 mb-2">마케팅 성과표를 열려면</h3>
            <p className="text-sm">위에서 고객사와 마케팅 종류를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
