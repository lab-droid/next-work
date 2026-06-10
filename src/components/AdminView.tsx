import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, firebaseConfig } from '../lib/firebase';
import { format } from 'date-fns';
import { Plus, X, Trash2, Settings2, CheckSquare, Square } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useModal } from '../lib/ModalContext';
import { useAuth } from '../lib/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: number;
  companyCode?: string | null;
  allowedMenus?: string[];
}

export const MASTER_MENUS = [
  { view: 'dashboard', label: '대시보드' },
  { view: 'projects', label: '프로젝트 홈' },
  { view: 'my-tasks', label: '내 업무' },
  { view: 'notice', label: '공지사항' },
  { view: 'messages', label: '메시지' },
  { view: 'kanban', label: '칸반보드' },
  { view: 'calendar', label: '캘린더' },
  { view: 'documents', label: '문서 관리' },
  { view: 'approval', label: '전자결재' },
  { view: 'hr', label: '근태 관리' },
  { view: 'crm', label: 'CRM' },
  { view: 'marketing', label: '마케팅' },
  { view: 'finance', label: '재무 관리' },
  { view: 'analytics', label: '데이터 분석' },
  { view: 'admin', label: '임직원 관리' }
];

export default function AdminView() {
  const { confirm, alert } = useModal();
  const { user: authUser } = useAuth();
  const [currentUserData, setCurrentUserData] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingMenusUserId, setEditingMenusUserId] = useState<string | null>(null);
  const [tempMenus, setTempMenus] = useState<string[]>([]);

  useEffect(() => {
    if (!authUser) return;
    const unsub = onSnapshot(doc(db, 'users', authUser.uid), (snap) => {
       if (snap.exists()) setCurrentUserData(snap.data() as UserProfile);
    });
    return () => unsub();
  }, [authUser]);

  useEffect(() => {
    if (!currentUserData) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];

      if (currentUserData.companyCode) {
        usersData = usersData.filter(u => u.companyCode === currentUserData.companyCode);
      } else {
        usersData = usersData.filter(u => !u.companyCode);
      }

      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [currentUserData]);

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
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: newName });
      
      // Save user to firestore 'users' collection manually
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: newName,
        lastLoginAt: Date.now(),
        ...(currentUserData?.companyCode ? { companyCode: currentUserData.companyCode } : {})
      });

      await secondaryAuth.signOut();
      
      setIsAddingUser(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Firebase 프로젝트 환경설정(Authentication > Sign-in method)에서 이메일/비밀번호 로그인을 활성화해주세요.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.');
      } else {
        setErrorMsg(err.message || '사용자 생성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    confirm({
      title: '확인',
      message: '선택한 사용자를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          alert({ title: "알림", message: '사용자가 삭제되었습니다. 실제 Firebase 계정 로그인을 막으려면 Firebase Console에서 삭제해야 합니다.' });
        } catch (err: any) {
          console.error(err);
          alert({ title: "알림", message: '사용자 삭제에 실패했습니다.' });
        }
      }
    });
  };

  const openMenuEditor = (user: UserProfile) => {
    setEditingMenusUserId(user.id);
    setTempMenus(user.allowedMenus || MASTER_MENUS.map(m => m.view));
  };

  const handleToggleMenu = (view: string) => {
    setTempMenus(prev => 
      prev.includes(view) ? prev.filter(m => m !== view) : [...prev, view]
    );
  };

  const saveMenuPermissions = async (userId: string) => {
    try {
      await setDoc(doc(db, 'users', userId), { allowedMenus: tempMenus }, { merge: true });
      setEditingMenusUserId(null);
    } catch(err) {
      console.error(err);
      alert({ title: '오류', message: '권한 저장에 실패했습니다.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-navy-900">회사 임직원 관리</h2>
        <button 
          onClick={() => setIsAddingUser(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition"
        >
          <Plus className="w-4 h-4" /> 사용자 추가
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">사용자</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">이메일</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">회사 코드</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500">마지막 로그인</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-500 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || "https://i.pravatar.cc/150"} 
                      alt="User" 
                      className="w-8 h-8 rounded-full border border-gray-200" 
                    />
                    <span className="font-medium text-navy-900">{user.displayName || '이름 없음'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {user.email}
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {user.companyCode || '-'}
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'yyyy-MM-dd HH:mm') : '-'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2 relative">
                    <button 
                      onClick={() => openMenuEditor(user)}
                      className="p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                      title="권한 설정"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    
                    {/* Role Dropdown Menu */}
                    {editingMenusUserId === user.id && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden flex flex-col text-left">
                        <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                          <span className="font-bold text-sm text-navy-900">메뉴 권한 설정</span>
                          <button onClick={() => setEditingMenusUserId(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                          {MASTER_MENUS.map(menu => (
                            <label key={menu.view} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={tempMenus.includes(menu.view)}
                                onChange={() => handleToggleMenu(menu.view)}
                              />
                              {tempMenus.includes(menu.view) ? (
                                <CheckSquare className="w-5 h-5 text-brand-500" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-300" />
                              )}
                              <span className="text-sm font-medium text-gray-700">{menu.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
                          <button 
                            onClick={() => saveMenuPermissions(user.id)}
                            className="flex-1 bg-brand-500 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-brand-600 transition"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  가입된 사용자가 없습니다.
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
              <h3 className="text-xl font-bold text-navy-900">새 사용자 추가</h3>
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
