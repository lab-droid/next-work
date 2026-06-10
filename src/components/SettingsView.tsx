import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import nextworkLogo from '../assets/images/nextwork_logo_1781108444824.png';
import { Settings, User, Bell, Shield, Paintbrush, Building, Image as ImageIcon } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useModal } from '../lib/ModalContext';

export default function SettingsView() {
  const { alert } = useModal();
  const { user, isAdmin } = useAuth();
  const [companyName, setCompanyName] = useState('넥스트워크');
  const [companyCode, setCompanyCode] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(nextworkLogo);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const docRef = doc(db, 'settings', 'company_info');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompanyName(docSnap.data().companyName || '넥스트워크');
          setCompanyCode(docSnap.data().companyCode || '');
          setCompanyLogo(docSnap.data().companyLogo || nextworkLogo);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (user) fetchCompanyData();
  }, [user]);

  const handleSaveCompanyInfo = async () => {
    if (!isAdmin) return;
    if (!companyName.trim() || !companyCode.trim()) {
      alert({ title: '알림', message: '회사명과 회사 코드를 모두 입력해주세요.' });
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'company_info'), {
        companyName: companyName.trim(),
        companyCode: companyCode.trim(),
        companyLogo: companyLogo,
        updatedAt: Date.now()
      });
      alert({ title: '알림', message: '회사 정보가 갱신되었습니다.' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/company_info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert({ title: '알림', message: 'JPG 또는 PNG 형식의 이미지만 업로드 가능합니다.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
             if (width > height) {
                 height = Math.round((height * maxDim) / width);
                 width = maxDim;
             } else {
                 width = Math.round((width * maxDim) / height);
                 height = maxDim;
             }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setCompanyLogo(canvas.toDataURL(file.type));
        }
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">환경설정</h2>
          <p className="text-gray-500 mt-1">계정 정보 및 어플리케이션 설정을 관리합니다.</p>
        </div>
        <div className="p-3 bg-brand-50 rounded-xl">
          <Settings className="w-6 h-6 text-brand-600" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl font-bold">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-900">{user?.displayName || '사용자'}</h3>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <button className="ml-auto px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            프로필 수정
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {isAdmin && (
            <div className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50/50 transition-colors">
              <div className="md:w-1/3 flex gap-3">
                <Building className="w-5 h-5 text-gray-400 font-bold" />
                <div>
                  <h4 className="font-bold text-navy-900">회사 정보</h4>
                  <p className="text-sm text-gray-500 mt-1">대시보드 상단 로고 설정</p>
                </div>
              </div>
              <div className="md:w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">회사 로고</label>
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                       {companyLogo ? (
                         <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       ) : (
                         <ImageIcon className="w-6 h-6 text-gray-400" />
                       )}
                     </div>
                     <div>
                       <input 
                         type="file" 
                         accept="image/png, image/jpeg" 
                         ref={fileInputRef} 
                         onChange={handleImageChange}
                         className="hidden" 
                       />
                       <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                         이미지 변경
                       </button>
                       <p className="text-xs text-gray-500 mt-1">정사각형(1:1) 비율의 JPG, PNG 권장</p>
                     </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">회사 코드</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={companyCode}
                      onChange={e => setCompanyCode(e.target.value)}
                      placeholder="로그인 시 필요한 회사 코드"
                      className="flex-1 w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                    />
                    <button 
                      onClick={handleSaveCompanyInfo}
                      disabled={isSaving}
                      className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition tracking-wide"
                    >
                      {isSaving ? '저장 중...' : '변경사항 저장'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50/50 transition-colors">
            <div className="md:w-1/3 flex gap-3">
              <Bell className="w-5 h-5 text-gray-400 font-bold" />
              <div>
                <h4 className="font-bold text-navy-900">알림 설정</h4>
                <p className="text-sm text-gray-500 mt-1">이메일 및 푸시 알림 수신 동의</p>
              </div>
            </div>
            <div className="md:w-2/3 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">새 메시지 알림 (Push)</span>
                <input type="checkbox" className="w-4 h-4 text-brand-600 rounded border-gray-300" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">업무 요약 알림 (Email)</span>
                <input type="checkbox" className="w-4 h-4 text-brand-600 rounded border-gray-300" defaultChecked />
              </label>
            </div>
          </div>

          <div className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50/50 transition-colors">
            <div className="md:w-1/3 flex gap-3">
              <Paintbrush className="w-5 h-5 text-gray-400 font-bold" />
              <div>
                <h4 className="font-bold text-navy-900">테마 설정</h4>
                <p className="text-sm text-gray-500 mt-1">화면 모드 및 색상</p>
              </div>
            </div>
            <div className="md:w-2/3 flex gap-4">
              <button 
                onClick={() => handleThemeChange('light')}
                className={`flex-1 py-3 border-2 rounded-xl text-sm font-bold transition-colors ${theme === 'light' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'}`}
              >
                라이트 모드
              </button>
              <button 
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 py-3 border-2 rounded-xl text-sm font-bold transition-colors ${theme === 'dark' ? 'border-brand-500 bg-navy-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'}`}
              >
                다크 모드
              </button>
            </div>
          </div>

          <div className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50/50 transition-colors">
            <div className="md:w-1/3 flex gap-3">
              <Shield className="w-5 h-5 text-gray-400 font-bold" />
              <div>
                <h4 className="font-bold text-navy-900">보안 및 비밀번호</h4>
                <p className="text-sm text-gray-500 mt-1">로그인 설정 관리</p>
              </div>
            </div>
            <div className="md:w-2/3">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                비밀번호 변경
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
