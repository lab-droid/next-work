import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { Plus, X, Trash2, Key, Building, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useModal } from '../lib/ModalContext';

interface CompanyCode {
  id: string;
  companyCode: string;
  companyName: string;
  password: string;
  firstLoggedUser: string | null;
  registeredUsersCount?: number;
  createdAt: number;
}

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  name?: string;
  role?: string;
}

export default function HQCodesView() {
  const { confirm, alert } = useModal();
  const [codes, setCodes] = useState<CompanyCode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [codeVal, setCodeVal] = useState('');
  const [nameVal, setNameVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Fetch Company Codes
    const codesRef = collection(db, 'company_codes');
    const qCodes = query(codesRef);
    const unsubscribeCodes = onSnapshot(qCodes, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CompanyCode[];
      
      // Sort by creation date descending
      data.sort((a, b) => b.createdAt - a.createdAt);
      setCodes(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'company_codes');
    });

    // 2. Fetch Users to map firstLoggedUser to names/emails
    const usersRef = collection(db, 'users');
    const qUsers = query(usersRef);
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeCodes();
      unsubscribeUsers();
    };
  }, []);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const formattedCode = codeVal.trim().toUpperCase();
    const formattedName = nameVal.trim();
    const formattedPassword = passwordVal.trim();

    if (!formattedCode || !formattedName || !formattedPassword) {
      setErrorMsg('모든 필드를 입력해 주세요.');
      return;
    }

    if (!/^[A-Z0-9]{3,20}$/.test(formattedCode)) {
      setErrorMsg('코드 형식이 올바르지 않습니다. (3~20자의 영문 대문자와 숫자만 사용 가능)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if it already exists
      const docRef = doc(db, 'company_codes', formattedCode);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setErrorMsg('이미 존재하는 회사 코드입니다. 다른 코드를 사용해 주세요.');
        setIsSubmitting(false);
        return;
      }

      await setDoc(docRef, {
        companyCode: formattedCode,
        companyName: formattedName,
        password: formattedPassword,
        firstLoggedUser: null,
        registeredUsersCount: 0,
        createdAt: Date.now()
      });

      setIsAdding(false);
      setCodeVal('');
      setNameVal('');
      setPasswordVal('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '회사 코드 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    confirm({
      title: '확인',
      message: `회사 코드 "${codeId}"를 삭제하시겠습니까? 관련 데이터는 제거되지 않으며 첫 로그인 권한 매핑만 삭제됩니다.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'company_codes', codeId));
          alert({ title: "알림", message: '회사 코드가 성공적으로 삭제되었습니다.' });
        } catch (err: any) {
          console.error(err);
          alert({ title: '오류', message: '회사 코드 삭제 중 오류가 발생했습니다.' });
        }
      }
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getUserInfo = (uid: string | null) => {
    if (!uid) return null;
    const found = users.find(u => u.id === uid);
    if (!found) return { name: '알 수 없음', email: uid };
    return {
      name: found.name || found.displayName || '이름 없음',
      email: found.email
    };
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-brand-600" />
            회사 코드 및 비밀번호 관리
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            본사 관리자는 각 회사의 전용 신규 가입 전용 코드 및 가입 비밀번호를 생성하고 매핑 현황을 모니터링할 수 있습니다.
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" /> 코드 및 비밀번호 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50 rounded-xl">
              <th className="py-3 px-4 text-sm font-bold text-navy-800">회사 코드</th>
              <th className="py-3 px-4 text-sm font-bold text-navy-800">회사명</th>
              <th className="py-3 px-4 text-sm font-bold text-navy-800">비밀번호</th>
              <th className="py-3 px-4 text-sm font-bold text-navy-800">첫 로그인 관리자</th>
              <th className="py-3 px-4 text-sm font-bold text-navy-800">생성일</th>
              <th className="py-3 px-4 text-sm font-bold text-navy-800 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(c => {
              const userInfo = getUserInfo(c.firstLoggedUser);
              const isPasswordVisible = !!visiblePasswords[c.id];
              return (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-mono bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-brand-100">
                      {c.companyCode}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-semibold text-navy-900">
                    {c.companyName}
                  </td>
                  <td className="py-4 px-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="font-mono font-medium tracking-wide">
                        {isPasswordVisible ? c.password : '••••••••'}
                      </span>
                      <button 
                        onClick={() => togglePasswordVisibility(c.id)}
                        className="p-1.5 text-gray-400 hover:text-navy-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title={isPasswordVisible ? '숨기기' : '비밀번호 보기'}
                      >
                        {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => copyToClipboard(c.password, c.id)}
                        className="p-1.5 text-gray-400 hover:text-navy-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center relative"
                        title="복사"
                      >
                        {copiedId === c.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm">
                    {userInfo ? (
                      <div>
                        <span className="font-bold text-brand-600 bg-brand-50/70 border border-brand-100 px-2.5 py-1 rounded-full text-xs">
                          {userInfo.name}
                        </span>
                        <div className="text-xs text-gray-400 mt-1 select-all">{userInfo.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1.5 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        미지정 (최초 사용자 자동 수락)
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400 font-medium">
                    {format(new Date(c.createdAt), 'yyyy-MM-dd')}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button 
                      onClick={() => handleDeleteCode(c.id)}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="코드 삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {codes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building className="w-8 h-8 text-gray-300" />
                    <p className="font-semibold text-gray-400">생성된 회사 코드가 없습니다.</p>
                    <p className="text-xs text-gray-400">새 회사 코드를 생성하여 전용 계정 등록을 활성화하세요.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                새 회사 코드 및 비밀번호 발급
              </h3>
              <button 
                onClick={() => setIsAdding(false)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-5 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCode} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-navy-800 mb-1">회사명</label>
                <input 
                  type="text"
                  required
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-navy-900"
                  placeholder="예: 넥스트인"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-navy-800 mb-1">회사 전용 가입 코드</label>
                <input 
                  type="text"
                  required
                  value={codeVal}
                  onChange={e => setCodeVal(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                  className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold text-brand-600"
                  placeholder="예: NEXTIN (3~20자의 대문자 및 숫자)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-navy-800 mb-1">가입 승인 비밀번호</label>
                <input 
                  type="text"
                  required
                  value={passwordVal}
                  onChange={e => setPasswordVal(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-3 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-navy-900"
                  placeholder="예: pass1234 (일반 유저 가입 시 요구됨)"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {isSubmitting ? '생성 중...' : '생성 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
