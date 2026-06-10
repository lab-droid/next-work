import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Building, User, Phone, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfileSetupView() {
  const { user, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: userProfile?.name || user?.displayName || '',
    department: userProfile?.department || '',
    phone: userProfile?.phone || '',
    employeeId: userProfile?.employeeId || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        displayName: formData.name, // compatibility
        isProfileComplete: true,
      }, { merge: true });
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('프로필 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-light flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-soft border border-gray-100 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-50 text-brand-500 flex items-center justify-center rounded-2xl mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-navy-900">프로필 정보 입력</h2>
          <p className="text-sm text-gray-500 mt-2">넥스트워크 시작을 위해 계정 정보를 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-navy-700 mb-1.5 ml-1">이름 <span className="text-red-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                placeholder="홍길동"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy-700 mb-1.5 ml-1">부서 / 직책 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                placeholder="마케팅팀 / 팀장"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy-700 mb-1.5 ml-1">사원번호 (선택)</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                placeholder="EMP-24439"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy-700 mb-1.5 ml-1">연락처 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          
          {userProfile?.role === 'admin' && (
            <div className="bg-brand-50 rounded-xl p-4 text-xs text-brand-800 border border-brand-100/50 mt-2 flex gap-3">
              <span className="text-brand-500 font-bold shrink-0">✔</span>
              <span>가입하시는 계정은 <strong>최고 관리자(Admin)</strong> 권한으로 배정되었습니다. 모든 시스템 워크스페이스 관리 권한을 가집니다.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !formData.name || !formData.department || !formData.phone}
            className="w-full mt-6 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '시작하기'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
