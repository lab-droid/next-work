import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Building } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentLogo: string | null;
}

export default function CompanySettingsModal({ isOpen, onClose, currentName, currentLogo }: Props) {
  const { userProfile } = useAuth();
  const [name, setName] = useState(currentName);
  const [logoBase64, setLogoBase64] = useState<string | null>(currentLogo);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setLogoBase64(currentLogo);
    }
  }, [isOpen, currentName, currentLogo]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!userProfile?.companyCode) {
      alert('회사 코드가 할당되어 있지 않습니다.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'company_codes', userProfile.companyCode), {
        companyName: name,
        companyLogo: logoBase64
      }, { merge: true });
      onClose();
    } catch (err) {
      console.error(err);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-navy-900">회사 정보 설정</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">회사 이름 (상호명)</label>
              <input 
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-brand-500"
                placeholder="예: (주)넥스트워크"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">로고 이미지 (옵션)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {logoBase64 ? (
                    <img src={logoBase64} alt="Preview" className="w-full h-full object-contain bg-white" />
                  ) : (
                    <Building className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition w-full justify-center"
                  >
                    <Upload className="w-4 h-4" /> PNG/JPG 업로드
                  </button>
                  {logoBase64 && (
                    <button 
                      onClick={() => setLogoBase64(null)}
                      className="text-sm text-red-500 hover:underline px-1"
                    >
                      로고 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-xl transition"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            disabled={isSubmitting || !name.trim()}
            className="bg-brand-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition disabled:opacity-50"
          >
            {isSubmitting ? '저장 중...' : '변경 내용 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
