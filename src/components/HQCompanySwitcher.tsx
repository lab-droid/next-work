import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Building } from 'lucide-react';

export default function HQCompanySwitcher() {
  const { isHQAdmin, userProfile, user } = useAuth();
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!isHQAdmin) return;
    const unsub = onSnapshot(collection(db, 'company_codes'), (snap) => {
      setCodes(snap.docs.map(doc => doc.id));
    });
    return () => unsub();
  }, [isHQAdmin]);

  if (!isHQAdmin) return null;

  const handleApplyCode = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        companyCode: newCode || null,
        role: newCode ? 'admin' : 'user'
      }, { merge: true });
    } catch (err) {
      console.error(err);
      alert('회사 코드 적용 실패');
    }
  };

  return (
    <div className="flex items-center gap-2 mr-0 sm:mr-2">
      <Building className="w-4 h-4 text-brand-500 hidden sm:block" />
      <select 
        value={userProfile?.companyCode || ''}
        onChange={handleApplyCode}
        className="bg-brand-50 border border-brand-200 text-brand-700 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-1.5 outline-none font-medium max-w-[120px] sm:max-w-xs"
      >
        <option value="">본사 뷰 (회사 미선택)</option>
        {codes.map(code => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
    </div>
  );
}
