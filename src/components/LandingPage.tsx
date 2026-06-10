import React, { useState } from 'react';
import { motion } from 'framer-motion';
import nextworkLogo from '../assets/images/nextwork_logo_1781108444824.png';
import { ArrowRight, MessageSquare, LayoutDashboard, CalendarDays, Users, CheckCircle2, Play, ChevronRight, LogIn, Building, KeyRound, Mail, Lock, X, Send, Plus, Search, Sparkles, Smile, Check, Briefcase, TrendingUp, HelpCircle, Clock, ArrowUpRight } from 'lucide-react';
import { ViewState } from '../App';
import { useAuth } from '../lib/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface LandingPageProps {
  onNavigate: (view: ViewState) => void;
}

const features = [
  { icon: MessageSquare, title: '팀 메신저', description: '실시간 소통으로 업무 효율을 극대화하세요.' },
  { icon: LayoutDashboard, title: '칸반보드', description: '드래그 앤 드롭으로 직관적인 프로젝트 관리.' },
  { icon: CalendarDays, title: '스마트 캘린더', description: '팀 전체의 일정을 한눈에 파악하세요.' },
  { icon: Users, title: 'CRM', description: '고객 데이터를 체계적으로 관리하고 분석하세요.' },
];

const pricing = [
  { name: 'Starter', price: '무료', desc: '초기 스타트업을 위한 필수 기능', features: ['최대 5명 팀원', '기본 메신저', '칸반보드 3개'] },
  { name: 'Pro', price: '₩12,000', desc: '성장하는 기업을 위한 최적의 플랜', features: ['무제한 팀원', '모든 기능 활성화', '우선 지원 서비스'], popular: true },
  { name: 'Enterprise', price: '별도 문의', desc: '대규모 조직을 위한 맞춤형 솔루션', features: ['전용 서버', '맞춤형 커스터마이징', '24/7 전담 관리자'] },
];

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { signIn } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'code' | 'login' | 'general-auth'>('code');
  const [isSignup, setIsSignup] = useState(false);
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-login interactive dashboard preview state
  const [activeDemo, setActiveDemo] = useState<'messenger' | 'kanban' | 'calendar' | 'crm'>('kanban');

  // Messenger State
  const [messages, setMessages] = useState<Array<{ sender: string; role: string; text: string; time: string; isSystem?: boolean; avatarColor?: string }>>([
    { sender: '민지현 팀장', role: '기획 / PM', text: '안녕하세요 여러분! 오늘 2.0 메이저 업데이트 소식 들으셨나요? 🎉', time: '오전 10:15', avatarColor: 'bg-indigo-500' },
    { sender: '김민우 사원', role: 'Frontend', text: '네! 빌드 안정성 테스트까지 마쳤고 스테이징 서버에 반영해두었습니다. 아주 부드럽네요!', time: '오전 10:17', avatarColor: 'bg-emerald-500' },
    { sender: '시스템 알림', role: 'System', text: '🚀 넥스트워크 v2.0 프로덕션 무중단 배포 완료 (협업 효율 +40% 향상)', time: '오전 10:20', isSystem: true }
  ]);
  const [demoInput, setDemoInput] = useState('');

  // Kanban State
  const [kanbanTasks, setKanbanTasks] = useState<Array<{ id: number; title: string; category: string; priority: '높음' | '보통' | '낮음'; status: 'todo' | 'progress' | 'feedback' | 'done'; date: string }>>([
    { id: 1, title: '메인 협업 피드 UX 사용성 개선', category: '기획', priority: '높음', status: 'todo', date: '6월 12일' },
    { id: 2, title: 'CRM 파이프라인 신규 고객 유입 필터 보강', category: '디자인', priority: '보통', status: 'progress', date: '6월 14일' },
    { id: 3, title: '프로덕션 Firestore 데이터 인덱싱 최적화', category: '개발', priority: '높음', status: 'feedback', date: '6월 11일' },
    { id: 4, title: '분기별 신규 기능 웨비나 녹화 세션 편집', category: '마케팅', priority: '낮음', status: 'done', date: '6월 10일' }
  ]);

  // Calendar State
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<number | null>(0);
  const calendarEvents = [
    { id: 0, title: '💡 2.0 피쳐 고도화 런칭 세션', date: '6월 10일', time: '오전 10:00 - 11:30', desc: '전사 기획 및 개발 주간 싱크 미팅, 업데이트 배포 피드백 반영 사항 최종 정리', color: 'bg-blue-500', textColor: 'text-blue-500' },
    { id: 1, title: '🥗 마케팅 전략 수립 주간 스프린트', date: '6월 11일', time: '오후 2:00 - 3:30', desc: '신규 기업용 연간 서비스 프로모션 배포 준비, 타겟 광고 채널 소재 검증', color: 'bg-amber-500', textColor: 'text-amber-500' },
    { id: 2, title: '🔒 보안 규정 침투 감사 및 컴플라이언스 점검', date: '6월 15일', time: '오후 4:00 - 5:00', desc: '정기 보안 규정 준수 점검 및 권한별 접근 규칙 검토', color: 'bg-emerald-500', textColor: 'text-emerald-500' }
  ];

  // CRM State
  const [crmMetric, setCrmMetric] = useState<'all' | 'leads' | 'negotiations' | 'contracts'>('all');
  const crmDeals = [
    { client: '(주) 네오테크', budget: '₩18,500,000', manager: '이정원 수석', status: '협상 완료', category: 'negotiations' },
    { client: '에이아이 유니버스', budget: '₩32,000,000', manager: '임지수 부장', status: '계약 성사 🎉', category: 'contracts' },
    { client: '글로벌 스타트업 랩스', budget: '₩8,200,000', manager: '박준형 대리', status: '제안 단계', category: 'leads' },
    { client: '아이두 테크놀로지', budget: '₩24,000,000', manager: '최진우 팀장', status: '계약 대기', category: 'contracts' },
    { client: '넥스트 제너레이션', budget: '₩14,000,000', manager: '정수연 차장', status: '미팅 완료', category: 'negotiations' },
  ];

  const handleSendDemoMessage = (textToSend?: string) => {
    const rawText = textToSend || demoInput;
    if (!rawText.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        sender: '나 (GUEST)',
        role: '체험자',
        text: rawText,
        time: '방금 전',
        avatarColor: 'bg-brand-500'
      }
    ]);
    if (!textToSend) setDemoInput('');
  };

  const moveKanbanTask = (id: number, nextStatus: 'todo' | 'progress' | 'feedback' | 'done') => {
    setKanbanTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCode.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'company_info'));
      if (docSnap.exists() && docSnap.data().companyCode === companyCode.trim()) {
        setStep('login');
      } else {
        setErrorMsg('유효하지 않은 회사 코드입니다.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneralAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const auth = getAuth();
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // AuthContext will automatically redirect the user
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Firebase 프로젝트 환경설정에서 이메일/비밀번호 로그인을 활성화해주세요.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('비밀번호는 6자리 이상이어야 합니다.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMsg('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        setErrorMsg(isSignup ? '회원가입에 실패했습니다.' : '이메일 또는 비밀번호가 일치하지 않습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      // Wait, let's just let the Google Button handle the new signup if needed,
      // since the prompt specifically said "Can log in with Google at company code login".
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Firebase 프로젝트 환경설정에서 이메일/비밀번호 로그인을 활성화해주세요.');
      } else {
        setErrorMsg('이메일 또는 비밀번호가 일치하지 않습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-surface-light min-h-screen font-sans selection:bg-brand-200">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={nextworkLogo} alt="NextWork Logo" className="w-8 h-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
            <span className="text-xl font-bold text-navy-900 tracking-tight">NextWork</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-navy-700">
            <a href="#features" className="hover:text-brand-500 transition-colors">기능 소개</a>
            <a href="#pricing" className="hover:text-brand-500 transition-colors">요금제</a>
            <a href="#stories" className="hover:text-brand-500 transition-colors">성공 사례</a>
          </nav>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setIsModalOpen(true); setStep('code'); setErrorMsg(''); }} 
              className="text-sm font-medium text-navy-700 hover:text-brand-500 flex items-center gap-1.5 transition-colors"
            >
              <Building className="w-4 h-4" />
              회사 코드로 로그인
            </button>
            <div className="w-px h-4 bg-gray-200 hidden md:block"></div>
            <button 
              onClick={() => { setIsModalOpen(true); setStep('general-auth'); setIsSignup(false); setErrorMsg(''); setEmail(''); setPassword(''); }} 
              className="text-sm font-medium text-navy-700 hover:text-navy-900 flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              로그인 / 회원가입
            </button>
            <button 
              onClick={() => { setIsModalOpen(true); setStep('general-auth'); setIsSignup(true); setErrorMsg(''); setEmail(''); setPassword(''); }}
              className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 shadow-soft hidden md:block"
            >
              무료로 시작하기
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-sm font-medium mb-8">
              <span className="flex h-2 w-2 rounded-full bg-brand-500"></span>
              넥스트워크 2.0 대규모 업데이트 완료
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-navy-900 mb-6 tracking-tight leading-tight">
              혁신적인 협업의 시작,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-blue-400">넥스트워크</span>
            </h1>
            <p className="text-lg md:text-xl text-navy-700 max-w-2xl mx-auto mb-10 leading-relaxed">
              파편화된 툴들을 하나로 모았습니다. 메신저부터 프로젝트 관리, CRM까지. 지금 바로 당신의 비즈니스를 다음 단계로 이끄세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => { setIsModalOpen(true); setStep('general-auth'); setIsSignup(false); setErrorMsg(''); setEmail(''); setPassword(''); }}
                className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-soft flex items-center justify-center gap-2 group"
              >
                대시보드 체험하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto bg-white text-navy-900 border border-gray-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                데모 영상
              </button>
            </div>
          </motion.div>

          {/* Statistics Counters banner */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-12 mb-8 bg-white/70 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/60 shadow-soft"
          >
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-extrabold text-navy-900">45,000+</p>
              <p className="text-xs md:text-sm font-medium text-gray-500 mt-1">누적 활성 사용자</p>
            </div>
            <div className="text-center border-l border-gray-100">
              <p className="text-2xl md:text-3xl font-extrabold text-brand-500">99.2%</p>
              <p className="text-xs md:text-sm font-medium text-gray-500 mt-1">프로젝트 완수율</p>
            </div>
            <div className="text-center border-l border-gray-100">
              <p className="text-2xl md:text-3xl font-extrabold text-[#34A853]">+40%</p>
              <p className="text-xs md:text-sm font-medium text-gray-500 mt-1">업무 생산성 향상</p>
            </div>
            <div className="text-center border-l border-gray-100">
              <p className="text-2xl md:text-3xl font-extrabold text-indigo-500">100%</p>
              <p className="text-xs md:text-sm font-medium text-gray-500 mt-1">실시간 클라우드 동기화</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-14 relative mx-auto max-w-5xl text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-indigo-500/5 to-transparent blur-3xl -z-10 rounded-[3rem]" />
            
            {/* Interactive Tab Selectors for App Demo */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <button
                onClick={() => setActiveDemo('kanban')}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border shadow-sm ${
                  activeDemo === 'kanban' 
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md scale-102' 
                  : 'bg-white hover:bg-gray-50 text-navy-700 hover:text-navy-900 border-gray-200'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                칸반보드 미리보기
              </button>
              <button
                onClick={() => setActiveDemo('messenger')}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border shadow-sm ${
                  activeDemo === 'messenger' 
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md scale-102' 
                  : 'bg-white hover:bg-gray-50 text-navy-700 hover:text-navy-900 border-gray-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                팀 메신저 미리보기
              </button>
              <button
                onClick={() => setActiveDemo('calendar')}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border shadow-sm ${
                  activeDemo === 'calendar' 
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md scale-102' 
                  : 'bg-white hover:bg-gray-50 text-navy-700 hover:text-navy-900 border-gray-200'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                스마트 캘린더 미리보기
              </button>
              <button
                onClick={() => setActiveDemo('crm')}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border shadow-sm ${
                  activeDemo === 'crm' 
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md scale-102' 
                  : 'bg-white hover:bg-gray-50 text-navy-700 hover:text-navy-900 border-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                CRM 고객통계 미리보기
              </button>
            </div>

            {/* High-Fidelity Interactive Dashboard Container */}
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-200 shadow-glass flex flex-col min-h-[520px]">
              {/* Window Header */}
              <div className="bg-navy-900 px-6 py-4 flex items-center justify-between text-white border-b border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 mr-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={nextworkLogo} alt="NextWork Logo" className="w-6 h-6 rounded object-cover" />
                    <span className="text-sm font-bold tracking-tight">NextWork Workspace</span>
                  </div>
                  <span className="hidden sm:inline px-2.5 py-0.5 rounded-full bg-navy-800 text-[10px] text-brand-300 font-bold border border-navy-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-brand-400 animate-pulse" /> LIVE DEMO VIEW
                  </span>
                </div>
                <div className="flex items-center gap-3 text-navy-300">
                  <div className="hidden sm:flex items-center bg-navy-800 px-3 py-1.5 rounded-lg border border-navy-700 text-xs text-navy-300 gap-1.5 w-48">
                    <Search className="w-3.5 h-3.5" />
                    <span className="text-navy-400 select-none">메뉴, 멤버 검색...</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs">G</div>
                </div>
              </div>

              {/* Window Body Panels */}
              <div className="flex-1 bg-surface-light flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
                
                {/* INTERACTIVE DEMO VIEWS */}
                {activeDemo === 'kanban' && (
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-navy-900 flex items-center gap-1.5">
                            📋 업무 칸반 보드 
                            <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 font-medium">실시간 인터랙티브 체험</span>
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">각 카드의 화살표 버튼을 클릭해 단계를 이동시켜보세요.</p>
                        </div>
                      </div>

                      {/* Kanban Columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                        {/* 1. TODO */}
                        <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/50 flex flex-col gap-3 min-h-[300px]">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">요청</span>
                            <span className="text-xs font-bold text-gray-400">{kanbanTasks.filter(t => t.status === 'todo').length}</span>
                          </div>
                          {kanbanTasks.filter(t => t.status === 'todo').map(task => (
                            <motion.div layout id={`demo-task-${task.id}`} key={task.id} className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm flex flex-col gap-2.5">
                              <span className="text-[10px] self-start px-2 py-0.5 rounded bg-gray-100 font-semibold text-gray-600">{task.category}</span>
                              <p className="text-xs font-bold text-navy-900 leading-snug">{task.title}</p>
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                                <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">높음</span>
                                <button 
                                  onClick={() => moveKanbanTask(task.id, 'progress')}
                                  className="text-[10px] text-brand-600 font-bold flex items-center gap-0.5 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded"
                                >
                                  진행 ➔
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* 2. PROGRESS */}
                        <div className="bg-blue-50/20 p-3.5 rounded-2xl border border-blue-100/50 flex flex-col gap-3 min-h-[300px]">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">진행 중</span>
                            <span className="text-xs font-bold text-blue-400">{kanbanTasks.filter(t => t.status === 'progress').length}</span>
                          </div>
                          {kanbanTasks.filter(t => t.status === 'progress').map(task => (
                            <motion.div layout id={`demo-task-${task.id}`} key={task.id} className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm flex flex-col gap-2.5 border-l-2 border-l-blue-500">
                              <span className="text-[10px] self-start px-2 py-0.5 rounded bg-blue-50 font-semibold text-blue-600">{task.category}</span>
                              <p className="text-xs font-bold text-navy-900 leading-snug">{task.title}</p>
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                                <span className="text-[10px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded">보통</span>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => moveKanbanTask(task.id, 'todo')}
                                    className="text-[10px] text-gray-500 hover:bg-gray-100 p-1 rounded"
                                  >
                                    ⇠
                                  </button>
                                  <button 
                                    onClick={() => moveKanbanTask(task.id, 'feedback')}
                                    className="text-[10px] text-brand-600 font-bold flex items-center gap-0.5 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded"
                                  >
                                    피드백 ➔
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* 3. FEEDBACK */}
                        <div className="bg-yellow-50/20 p-3.5 rounded-2xl border border-yellow-100/50 flex flex-col gap-3 min-h-[300px]">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">피드백</span>
                            <span className="text-xs font-bold text-amber-400">{kanbanTasks.filter(t => t.status === 'feedback').length}</span>
                          </div>
                          {kanbanTasks.filter(t => t.status === 'feedback').map(task => (
                            <motion.div layout id={`demo-task-${task.id}`} key={task.id} className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm flex flex-col gap-2.5 border-l-2 border-l-amber-500">
                              <span className="text-[10px] self-start px-2 py-0.5 rounded bg-amber-50 font-semibold text-amber-600">{task.category}</span>
                              <p className="text-xs font-bold text-navy-900 leading-snug">{task.title}</p>
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                                <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">높음</span>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => moveKanbanTask(task.id, 'progress')}
                                    className="text-[10px] text-gray-500 hover:bg-gray-100 p-1 rounded"
                                  >
                                    ⇠
                                  </button>
                                  <button 
                                    onClick={() => moveKanbanTask(task.id, 'done')}
                                    className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded"
                                  >
                                    완료 ✓
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* 4. DONE */}
                        <div className="bg-emerald-50/20 p-3.5 rounded-2xl border border-emerald-100/50 flex flex-col gap-3 min-h-[300px]">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">완료</span>
                            <span className="text-xs font-bold text-emerald-400">{kanbanTasks.filter(t => t.status === 'done').length}</span>
                          </div>
                          {kanbanTasks.filter(t => t.status === 'done').map(task => (
                            <motion.div layout id={`demo-task-${task.id}`} key={task.id} className="bg-white/80 p-3.5 rounded-xl border border-gray-100/60 shadow-sm flex flex-col gap-2.5 border-l-2 border-l-emerald-500 opacity-90 line-through">
                              <span className="text-[10px] self-start px-2 py-0.5 rounded bg-gray-50 font-semibold text-gray-500">{task.category}</span>
                              <p className="text-xs font-bold text-gray-500 leading-snug">{task.title}</p>
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                                <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-1.5 py-0.5 rounded">완료</span>
                                <button 
                                  onClick={() => moveKanbanTask(task.id, 'feedback')}
                                  className="text-[10px] text-gray-500 hover:bg-gray-100 px-2 py-1 rounded"
                                >
                                  되돌리기 ⇠
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-800 flex items-center justify-between">
                      <span>💡 <strong>직관적인 팀 보드</strong>: 멤버들을 업무 카드에 지정하고 진행율까지 즉각적으로 연동할 수 있습니다.</span>
                      <button 
                        onClick={() => { setIsModalOpen(true); setStep('general-auth'); }}
                        className="text-xs text-white bg-brand-500 px-3 py-1 font-bold rounded-lg hover:bg-brand-600 transition-colors shrink-0"
                      >
                        체험 시작
                      </button>
                    </div>
                  </div>
                )}

                {activeDemo === 'messenger' && (
                  <div className="flex-1 flex flex-col md:flex-row h-full">
                    {/* Left chat room list */}
                    <div className="w-full md:w-56 bg-white border-r border-gray-100 p-4 flex flex-col justify-between shrink-0">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">채널 목록</span>
                          <Plus className="w-4 h-4 text-gray-400 cursor-pointer hover:text-navy-900" />
                        </div>
                        <ul className="space-y-1">
                          <li className="px-3 py-2 bg-gray-50 text-brand-600 font-bold text-xs rounded-lg flex items-center justify-between">
                            <span className="flex items-center gap-1.5"># 일반-공지사항</span>
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                          </li>
                          <li className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-xs rounded-lg cursor-pointer transition-colors">
                            # 기획-동기화
                          </li>
                          <li className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-xs rounded-lg cursor-pointer transition-colors">
                            # 마케팅-지표
                          </li>
                        </ul>
                        <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">멤버 (동접 4명)</span>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              민지현 팀장
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              김민우 사원
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              나 (체험자)
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-brand-50/50 rounded-xl border border-brand-100/50 text-[11px] text-brand-800 leading-relaxed">
                        실시간 답장 시뮬레이션을 아래에서 눌러 참여해보세요.
                      </div>
                    </div>

                    {/* Right core chat room */}
                    <div className="flex-1 p-5 flex flex-col justify-between bg-surface-light min-h-[350px]">
                      <div>
                        {/* Chat Top bar */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 mb-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-navy-900"># 일반-공지사항</span>
                            <span className="text-[10px] text-gray-500">프로젝트 일원 12명 참여 중</span>
                          </div>
                          <HelpCircle className="w-4 h-4 text-gray-400" />
                        </div>

                        {/* Message list */}
                        <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar pr-1 pb-4">
                          {messages.map((msg, i) => msg.isSystem ? (
                            <div key={i} className="flex justify-center my-2">
                              <span className="bg-gray-250 text-navy-700 bg-white shadow-sm border border-gray-100 px-3.5 py-1.5 rounded-full text-[10px] font-bold">
                                {msg.text}
                              </span>
                            </div>
                          ) : (
                            <div key={i} className={`flex gap-3 items-start ${msg.sender === '나 (GUEST)' ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${msg.avatarColor || 'bg-brand-500'}`}>
                                {msg.sender.charAt(0)}
                              </div>
                              <div className={`max-w-[70%] ${msg.sender === '나 (GUEST)' ? 'text-right' : ''}`}>
                                <div className="flex items-center gap-1.5 mb-1 justify-start">
                                  <span className="text-xs font-bold text-navy-900">{msg.sender}</span>
                                  <span className="text-[9px] text-gray-400">{msg.role}</span>
                                </div>
                                <div className={`p-3 rounded-2xl text-xs leading-relaxed inline-block ${msg.sender === '나 (GUEST)' ? 'bg-brand-500 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-navy-800 rounded-tl-none shadow-sm'}`}>
                                  {msg.text}
                                </div>
                                <p className="text-[8px] text-gray-400 mt-0.5">{msg.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Message inputs and smart replies */}
                      <div className="space-y-3 pt-3 border-t border-gray-200/50">
                        {/* Quick Interactive replies block */}
                        <div className="flex flex-wrap gap-1.5">
                          <button 
                            onClick={() => handleSendDemoMessage('와 정말 신선하네요! 앞으로 넥스트워크로 갈아타야겠습니다. 🚀')}
                            className="text-[10px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 hover:border-brand-300 transition-all border border-brand-100 px-2.5 py-1.5 rounded-full"
                          >
                            💬 갈아타고 싶네요! 🚀
                          </button>
                          <button 
                            onClick={() => handleSendDemoMessage('이메일/패스워드 로그인과 연동 과정이 매끄럽네요. 멋집니다! 👍')}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100/50 hover:border-blue-300 transition-all border border-blue-100 px-2.5 py-1.5 rounded-full"
                          >
                            💬 매끄럽고 멋집니다! 👍
                          </button>
                        </div>

                        {/* Interactive message input */}
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={demoInput}
                            onChange={e => setDemoInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendDemoMessage()}
                            placeholder="직접 메시지를 입력하고 전송 버튼을 눌러보세요..."
                            className="flex-1 bg-white border border-gray-200/80 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-brand-500 transition-all focus:ring-2 focus:ring-brand-100 font-medium"
                          />
                          <button 
                            onClick={() => handleSendDemoMessage()}
                            className="bg-brand-500 hover:bg-brand-600 text-white p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemo === 'calendar' && (
                  <div className="flex-1 p-6 flex flex-col md:flex-row gap-6">
                    {/* Left: Mini Monthly Grid */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-navy-900">2026년 6월 캘린더</span>
                        <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-2.5 py-1 rounded">이번 주 일정 3건</span>
                      </div>
                      
                      {/* Grid representation */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 font-semibold mb-2">
                        <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 30 }).map((_, i) => {
                          const day = i + 1;
                          const hasEvent = day === 10 || day === 11 || day === 15;
                          const isSelected = (day === 10 && selectedCalendarEvent === 0) || 
                                             (day === 11 && selectedCalendarEvent === 1) || 
                                             (day === 15 && selectedCalendarEvent === 2);
                          let eventClass = "h-8 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer hover:bg-brand-50 transition-colors ";
                          if (isSelected) {
                            eventClass += "bg-brand-500 text-white hover:bg-brand-500";
                          } else if (hasEvent) {
                            eventClass += "bg-brand-50 text-brand-600 border border-brand-100 font-bold";
                          } else {
                            eventClass += "text-navy-700 bg-white hover:bg-gray-100";
                          }

                          return (
                            <div 
                              key={i} 
                              className={eventClass}
                              onClick={() => {
                                if (day === 10) setSelectedCalendarEvent(0);
                                if (day === 11) setSelectedCalendarEvent(1);
                                if (day === 15) setSelectedCalendarEvent(2);
                              }}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] mt-4 text-gray-400 font-medium">💡 노란색/하늘색 숫자를 클릭하면 해당 구체 일정이 열립니다.</p>
                    </div>

                    {/* Right: Selected event inspector sidebar */}
                    <div className="w-full md:w-64 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between shrink-0">
                      {selectedCalendarEvent !== null ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white px-2 py-0.5 rounded font-bold bg-brand-500">상세 일정</span>
                            <span className="text-[10px] text-gray-500 font-medium">{calendarEvents[selectedCalendarEvent].date}</span>
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-navy-900 leading-snug">{calendarEvents[selectedCalendarEvent].title}</h5>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              {calendarEvents[selectedCalendarEvent].time}
                            </p>
                          </div>
                          <div className="bg-surface-light p-3 rounded-xl border border-gray-100">
                            <p className="text-xs text-navy-800 leading-relaxed font-medium">
                              {calendarEvents[selectedCalendarEvent].desc}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-center text-xs text-gray-400">
                          날짜를 클릭해 전체 일정을 확인해보세요.
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-gray-50 mt-4 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">팀원 할당 목록 (3명)</span>
                        <div className="flex gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[9px]">민</span>
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px]">김</span>
                          <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[9px]">이</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemo === 'crm' && (
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      {/* Top quick pipeline filter */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-150">
                        <div>
                          <h4 className="text-lg font-bold text-navy-900 flex items-center gap-1.5">📊 영업 CRM 피드</h4>
                          <p className="text-xs text-gray-500 mt-1">체계적인 신규 영업 리드 관리를 지원합니다.</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button 
                            onClick={() => setCrmMetric('all')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${crmMetric === 'all' ? 'bg-navy-900 text-white border-navy-900' : 'bg-white hover:bg-gray-50 text-navy-700 border-gray-200'}`}
                          >
                            전체 딜
                          </button>
                          <button 
                            onClick={() => setCrmMetric('leads')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${crmMetric === 'leads' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white hover:bg-gray-50 text-blue-600 border-gray-200'}`}
                          >
                            리드
                          </button>
                          <button 
                            onClick={() => setCrmMetric('negotiations')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${crmMetric === 'negotiations' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white hover:bg-gray-50 text-amber-600 border-gray-200'}`}
                          >
                            협상
                          </button>
                          <button 
                            onClick={() => setCrmMetric('contracts')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${crmMetric === 'contracts' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white hover:bg-gray-50 text-emerald-600 border-gray-200'}`}
                          >
                            계약
                          </button>
                        </div>
                      </div>

                      {/* Deals dynamic list layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Summary pipeline progress widget */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                          <span className="text-[10px] font-bold text-navy-700 bg-gray-150 px-2 py-1 rounded">2026 영업 인덱스 깔때기</span>
                          <div className="space-y-2.5 pt-1">
                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-navy-900 mb-1">
                                <span>요청 리드 유입</span>
                                <span>65건 (100%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-brand-500 h-full rounded-full" style={{ width: '100%' }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-navy-900 mb-1">
                                <span>적격 협상 진행</span>
                                <span>32건 (49%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: '49%' }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-navy-900 mb-1">
                                <span>계약 완료 성공률</span>
                                <span>21건 (32%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '32%' }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Clients detail list filtered */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between max-h-[190px] overflow-y-auto custom-scrollbar">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">영업 정보 리스트 ({crmDeals.filter(d => crmMetric === 'all' || d.category === crmMetric).length}건)</span>
                          <div className="space-y-2">
                            {crmDeals.filter(d => crmMetric === 'all' || d.category === crmMetric).map((deal, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                                <div>
                                  <h6 className="text-[11px] font-bold text-navy-900">{deal.client}</h6>
                                  <p className="text-[9px] text-gray-500">담당: {deal.manager}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-navy-900 block">{deal.budget}</span>
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                    deal.category === 'contracts' 
                                    ? 'bg-emerald-50 text-emerald-600' 
                                    : deal.category === 'negotiations' 
                                    ? 'bg-amber-50 text-amber-600' 
                                    : 'bg-blue-50 text-blue-600'
                                  }`}>{deal.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-800 flex items-center justify-between">
                      <span>📊 <strong>영업 가시성 확보</strong>: 계약 파이프라인의 병목 제거 및 성과분석 차트를 클릭 몇 번으로 빌드합니다.</span>
                      <button 
                        onClick={() => { setIsModalOpen(true); setStep('general-auth'); }}
                        className="text-xs text-white bg-brand-500 px-3.5 py-1 font-bold rounded-lg hover:bg-brand-600 transition-colors shrink-0"
                      >
                        체험 시작
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">하나의 플랫폼, 모든 기능</h2>
              <p className="text-navy-700 text-lg">스타트업과 중소기업에 꼭 필요한 기능만 담았습니다.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, idx) => (
                <div key={idx} className="p-8 rounded-2xl bg-surface-light border border-gray-100 hover:border-brand-200 hover:shadow-soft transition-all group">
                  <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-6 group-hover:bg-brand-50 group-hover:border-brand-200 group-hover:text-brand-500 transition-colors">
                    <feature.icon className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900 mb-3">{feature.title}</h3>
                  <p className="text-navy-700 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">합리적인 요금제</h2>
              <p className="text-navy-700 text-lg">규모에 맞는 플랜을 선택하고 언제든 업그레이드하세요.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricing.map((plan, idx) => (
                <div key={idx} className={`relative p-8 rounded-3xl border ${plan.popular ? 'border-brand-500 shadow-glass bg-white' : 'border-gray-200 bg-white/50 backdrop-blur-sm'}`}>
                  {plan.popular && (
                    <div className="absolute -top-4 inset-x-0 flex justify-center">
                      <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">Most Popular</span>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-navy-900 mb-2">{plan.name}</h3>
                  <p className="text-navy-700 mb-6 text-sm h-10">{plan.desc}</p>
                  <div className="text-4xl font-extrabold text-navy-900 mb-8">{plan.price}<span className="text-lg text-gray-500 font-medium">/월</span></div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-navy-800">
                        <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-3.5 rounded-xl font-bold transition-all ${plan.popular ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-md' : 'bg-brand-50 hover:bg-brand-100 text-brand-600'}`}>
                    선택하기
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-navy-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src={nextworkLogo} alt="NextWork Logo" className="w-6 h-6 rounded object-cover" referrerPolicy="no-referrer" />
              <span className="text-lg font-bold text-white tracking-tight">NextWork</span>
            </div>
            <p className="max-w-sm mb-6">혁신적인 협업의 시작. 모든 업무를 하나의 공간에서 가장 스마트하게 관리하세요.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Case Studies</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 mt-8 border-t border-navy-800 text-xs text-gray-500 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p>© 2026 NextWork Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
          <div className="text-center md:text-left space-y-1.5 border-t border-navy-800/40 pt-4 leading-relaxed text-gray-400">
            <p>주식회사 넥스트인 ｜ 대표자 : 정시훈 ｜ 사업자등록번호 : 280-86-03849 ｜ 법인등록번호 : 180111-0162061</p>
            <p>대표번호 0507-1349-0268 ｜ 대표메일 info@nextin.ai.kr</p>
            <p>개인정보보호책임자 : 정시훈 ｜ 홈페이지운영담당자 : 허예령</p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
          >
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8">
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
                {step === 'code' ? <Building className="w-6 h-6 text-brand-600" /> : <Lock className="w-6 h-6 text-brand-600" />}
              </div>
              <h3 className="text-2xl font-bold text-navy-900 mb-2">
                {step === 'code' ? '회사 코드 입력' : step === 'login' ? '임직원 로그인' : isSignup ? '회원가입' : '로그인'}
              </h3>
              <p className="text-gray-500 mb-8 max-w-[260px]">
                {step === 'code' ? '사내 관리자에게 전달받은 회사 코드를 입력해주세요.' : step === 'login' ? '발급받은 이메일과 비밀번호로 로그인하세요.' : isSignup ? '간편하게 가입하고 모든 기능을 사용해보세요.' : '다시 오신 것을 환영합니다!'}
              </p>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                  {errorMsg}
                </div>
              )}

              {step === 'general-auth' ? (
                <div className="space-y-4">
                  <form onSubmit={handleGeneralAuth} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="w-5 h-5 text-gray-400" />
                        </div>
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium"
                          placeholder="user@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="w-5 h-5 text-gray-400" />
                        </div>
                        <input 
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium"
                          placeholder="비밀번호"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors disabled:opacity-50 mt-6"
                    >
                      {isLoading ? '처리 중...' : (isSignup ? '가입하기' : '로그인')}
                    </button>
                  </form>
                  <div className="relative py-2 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <span className="relative bg-white px-4 text-sm text-gray-500">또는</span>
                  </div>
                  <button 
                    onClick={async () => {
                      setErrorMsg('');
                      setIsLoading(true);
                      try {
                        await signIn();
                      } catch (err: any) {
                        if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
                          if (err.code === 'auth/unauthorized-domain') {
                            setErrorMsg('Firebase 콘솔(Authentication settings)에서 현재 앱의 URL 도메인을 Authorized domains에 추가해주세요.');
                          } else {
                            setErrorMsg('Google 로그인에 실패했습니다: ' + (err.message || '') + ' (새 탭에서 열어보시거나 팝업 차단을 해제해주세요)');
                          }
                        }
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    type="button"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-white border border-gray-200 text-navy-900 flex items-center justify-center gap-2 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 {isSignup ? '시작하기' : '로그인'}
                  </button>
                  <p className="text-center text-sm text-gray-500 mt-4">
                    {isSignup ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
                    <button 
                      onClick={() => { setIsSignup(!isSignup); setErrorMsg(''); setEmail(''); setPassword(''); }}
                      type="button"
                      className="ml-1 text-brand-600 font-medium hover:underline"
                    >
                      {isSignup ? '로그인하기' : '회원가입하기'}
                    </button>
                  </p>
                </div>
              ) : step === 'code' ? (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">회사 코드</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="w-5 h-5 text-gray-400" />
                      </div>
                      <input 
                        type="text"
                        autoFocus
                        required
                        value={companyCode}
                        onChange={e => setCompanyCode(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium"
                        placeholder="회사 코드를 입력하세요"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors disabled:opacity-50 mt-4"
                  >
                    {isLoading ? '확인 중...' : '다음'}
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleCompanyLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="w-5 h-5 text-gray-400" />
                        </div>
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium"
                          placeholder="user@company.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="w-5 h-5 text-gray-400" />
                        </div>
                        <input 
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium"
                          placeholder="비밀번호"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors disabled:opacity-50 mt-6"
                    >
                      {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                  </form>
                  <div className="relative py-2 text-center mt-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <span className="relative bg-white px-4 text-sm text-gray-500">또는</span>
                  </div>
                  <button 
                    onClick={async () => {
                      setErrorMsg('');
                      setIsLoading(true);
                      try {
                        await signIn(step === 'login' ? companyCode : undefined);
                      } catch (err: any) {
                        if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
                          if (err.code === 'auth/unauthorized-domain') {
                            setErrorMsg('Firebase 콘솔(Authentication settings)에서 현재 앱의 URL 도메인을 Authorized domains에 추가해주세요.');
                          } else {
                            setErrorMsg('Google 로그인에 실패했습니다: ' + (err.message || '') + ' (새 탭에서 열어보시거나 팝업 차단을 해제해주세요)');
                          }
                        }
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    type="button"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-white border border-gray-200 text-navy-900 flex items-center justify-center gap-2 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 mt-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 로그인
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
