import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Plus, X, Search, Phone, Mail, Building, Trash2, Edit2 } from 'lucide-react';
import { useModal } from '../lib/ModalContext';

interface Customer {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  createdAt: number;
}

export default function CRMView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('lead');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'customers'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      // Sort by latest
      customersData.sort((a, b) => b.createdAt - a.createdAt);
      setCustomers(customersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return () => unsubscribe();
  }, [user]);

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setEmail(customer.email);
      setPhone(customer.phone);
      setCompany(customer.company);
      setStatus(customer.status);
    } else {
      setEditingCustomer(null);
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setStatus('lead');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name, email, phone, company, status
        });
      } else {
        const newId = doc(collection(db, 'customers')).id;
        await setDoc(doc(db, 'customers', newId), {
          userId: user.uid,
          name, email, phone, company, status,
          createdAt: Date.now()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: '확인',
      message: '고객을 삭제하시겠습니까?',
      onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'customers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'customers');
      }
    }
    });
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm min-h-[600px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-navy-900">고객 관리 (CRM)</h2>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="고객명, 회사명 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            고객 추가
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">고객명</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">연락처</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">이메일</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">회사</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">상태</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(customer => (
              <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-navy-900">{customer.name}</div>
                </td>
                <td className="py-3 px-4 text-gray-600 text-sm">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Phone className="w-3 h-3 text-gray-400" />
                    {customer.phone || '-'}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-gray-400" />
                    {customer.email || '-'}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3 h-3 text-gray-400" />
                    {customer.company || '-'}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                    customer.status === 'active' ? 'bg-green-100 text-green-700' :
                    customer.status === 'lead' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {customer.status === 'active' ? '활성' : customer.status === 'lead' ? '잠재' : '비활성'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => openModal(customer)}
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(customer.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  등록된 고객이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingCustomer ? '고객 정보 수정' : '신규 고객 추가'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">고객명 *</label>
                <input 
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input 
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                  <input 
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                <input 
                  type="text" value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select 
                  value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                >
                  <option value="lead">잠재 고객 (Lead)</option>
                  <option value="active">활성 고객 (Active)</option>
                  <option value="inactive">비활성 (Inactive)</option>
                </select>
              </div>
              <div className="flex justify-end pt-2 gap-2">
                <button 
                  type="button" onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                >
                  취소
                </button>
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
