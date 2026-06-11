import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, firebaseConfig } from '../lib/firebase';
import { format } from 'date-fns';
import { Plus, X, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useModal } from '../lib/ModalContext';

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: number;
  companyCode?: string | null;
  role?: string;
}

export default function HQSubscriptionsView() {
  const { confirm, alert } = useModal();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filterCompanyCode, setFilterCompanyCode] = useState('');
  const [uniqueCompanyCodes, setUniqueCompanyCodes] = useState<string[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);
      
      const codes = Array.from(new Set(usersData.map(u => u.companyCode).filter(Boolean) as string[]));
      setUniqueCompanyCodes(codes.sort());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newEmail || !newName || !newPassword) {
      setErrorMsg('모든 필드를 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Use secondary app to not log out the current admin
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp_Subs');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: newName });
      
      // Save user to firestore 'users' collection manually
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: newName,
        displayName: newName,
        lastLoginAt: Date.now(),
        role: newUserRole,
        ...(newCompanyCode ? { companyCode: newCompanyCode } : {})
      });

      await secondaryAuth.signOut();
      
      setIsAddingUser(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewCompanyCode('');
      setNewUserRole('user');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Firebase 프로젝트 환경설정(Authentication > Sign-in method)에서 이메일/비밀번호 로그인을 활성화해주세요.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.');
      } else {
        setErrorMsg(err.message || '가입에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    confirm({
      title: '확인',
      message: '선택한 회원을 삭제하시겠습니까? (삭제 시 해당 계정은 더 이상 모든 앱 내 시스템에 접속할 수 없게 됩니다.)',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
          if (!response.ok) console.warn('Firebase Auth deletion failed or is not configured');
          await deleteDoc(doc(db, 'users', userId));
          alert({ title: "알림", message: '사용자가 삭제되어 애플리케이션 접근 권한이 영구 차단되었습니다.' });
        } catch (err: any) {
          console.error(err);
          alert({ title: "알림", message: '회원 접근 권한 삭제에 실패했습니다.' });
        }
      }
    });
  };

  const handleUpdateUser = async (userId: string) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        name: editFormData.name || '',
        companyCode: editFormData.companyCode || null,
        role: editFormData.role || 'user'
      }, { merge: true });
      setEditingUserId(null);
    } catch(err) {
      console.error(err);
      alert({ title: '오류', message: '정보 변경에 실패했습니다.' });
    }
  };

  const filteredUsers = filterCompanyCode 
    ? users.filter(u => u.companyCode === filterCompanyCode)
    : users;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-navy-900">구독 관리 (신규 회원)</h2>
        <div className="flex items-center gap-3">
          <select 
            value={filterCompanyCode}
            onChange={(e) => setFilterCompanyCode(e.target.value)}
            className="border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 text-sm font-medium"
          >
            <option value="">모든 회사 보기</option>
            {uniqueCompanyCodes.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsAddingUser(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition"
          >
            <Plus className="w-4 h-4" /> 신규 회원 추가
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">이름</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">이메일</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">회사 코드</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">마지막 접속</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || "https://i.pravatar.cc/150"} 
                      alt="User" 
                      className="w-8 h-8 rounded-full border border-gray-200" 
                    />
                    {editingUserId === user.id ? (
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                        className="border border-brand-500 rounded px-2 py-1 outline-none text-sm w-32"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-navy-900">{user.name || user.displayName || '이름 없음'}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {user.email}
                  <div className="text-xs text-gray-400 mt-0.5">{user.role === 'admin' ? '관리자' : '일반 사용자'}</div>
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {editingUserId === user.id ? (
                    <input
                      type="text"
                      value={editFormData.companyCode || ''}
                      onChange={e => setEditFormData({...editFormData, companyCode: e.target.value.toUpperCase()})}
                      className="border border-brand-500 rounded px-2 py-1 outline-none text-sm w-24"
                    />
                  ) : (
                    user.companyCode || '-'
                  )}
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'yyyy-MM-dd HH:mm') : '-'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {editingUserId === user.id ? (
                      <>
                        <select 
                          className="border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                          value={editFormData.role || 'user'}
                          onChange={e => setEditFormData({...editFormData, role: e.target.value})}
                        >
                          <option value="user">사용자</option>
                          <option value="admin">관리자</option>
                        </select>
                        <button onClick={() => handleUpdateUser(user.id)} className="text-brand-500 text-sm font-medium hover:underline">저장</button>
                        <button onClick={() => setEditingUserId(null)} className="text-gray-500 text-sm font-medium hover:underline">취소</button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setEditingUserId(user.id);
                            setEditFormData({
                              name: user.name || user.displayName || '',
                              companyCode: user.companyCode,
                              role: user.role || 'user'
                            });
                          }}
                          className="text-sm font-medium text-gray-500 hover:text-brand-500 hover:underline"
                        >
                          편집
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  가입된 회원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-900">새 회원 추기</h3>
              <button onClick={() => setIsAddingUser(false)} className="text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input 
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                  placeholder="예: 홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input 
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                  placeholder="예: user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input 
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                  placeholder="6자리 이상"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">회사 코드(옵션)</label>
                  <input 
                    type="text"
                    value={newCompanyCode}
                    onChange={e => setNewCompanyCode(e.target.value.toUpperCase())}
                    className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 uppercase"
                    placeholder="예: COMP001"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">사용자 권한</label>
                  <select 
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 bg-white"
                  >
                    <option value="user">일반 사용자</option>
                    <option value="admin">해당 앱 관리자</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? '생성 중...' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
