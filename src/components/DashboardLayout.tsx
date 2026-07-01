import React, { useState, useEffect } from 'react';
import { ViewState } from '../App';
import nextworkLogo from '../assets/images/nextwork_logo_1781108444824.png';
import ProjectListView from './ProjectListView';
import ProjectDashboardView from './ProjectDashboardView';
import { 
  LayoutDashboard, 
  MessageSquare, 
  KanbanSquare, 
  Calendar, 
  Users, 
  Settings, 
  Search,
  LogOut,
  Menu,
  X,
  Wallet,
  FileText,
  BarChart2,
  FileSignature,
  Clock,
  Megaphone,
  Target,
  Shield,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  FolderOpen,
  ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';
import SearchModal from './SearchModal';
import NotificationBell from './NotificationBell';
import DashboardHome from './DashboardHome';
import KanbanBoard from './KanbanBoard';
import AdminView from './AdminView';
import FinanceView from './FinanceView';
import CalendarView from './CalendarView';
import CRMView from './CRMView';
import MessagesView from './MessagesView';
import DocumentsView from './DocumentsView';
import AnalyticsView from './AnalyticsView';
import NoticeView from './NoticeView';
import HRView from './HRView';
import ApprovalView from './ApprovalView';
import MarketingView from './MarketingView';
import SettingsView from './SettingsView';
import HQPlaceholderView from './HQPlaceholderView';
import HQSubscriptionsView from './HQSubscriptionsView';
import HQCodesView from './HQCodesView';
import HQCompanySwitcher from './HQCompanySwitcher';
import CompanySettingsModal from './CompanySettingsModal';
import { useAuth } from '../lib/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DashboardLayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

type NavItem = {
  view?: string;
  icon: any;
  label: string;
  subItems?: { view: string; label: string }[];
};

const getNavItems = (isHQAdmin: boolean) => {
  const items: NavItem[] = [];
  
  if (isHQAdmin) {
    items.push({
      icon: Shield,
      label: '본사 콘솔',
      subItems: [
        { view: 'hq-dashboard', label: '대시보드' },
        { view: 'hq-codes', label: '코드 관리' },
        { view: 'hq-plans', label: '요금제 관리' },
        { view: 'hq-subscriptions', label: '구독 관리' },
        { view: 'hq-payments', label: '결제 내역' },
        { view: 'hq-sales', label: '매출 관리' },
        { view: 'hq-tenants', label: '테넌트 관리' },
        { view: 'hq-modules', label: '모듈 카탈로그' },
        { view: 'hq-sidebar', label: '사이드바 정책' },
        { view: 'hq-audit', label: '감사로그' },
        { view: 'hq-system', label: '시스템' },
        { view: 'hq-status', label: '상태' },
        { view: 'hq-security', label: '보안 정책' },
      ]
    });
  }

  items.push(
    { view: 'dashboard', icon: LayoutDashboard, label: '대시보드' },
    { view: 'projects', icon: FolderOpen, label: '프로젝트' },
    { view: 'all-tasks', icon: ClipboardList, label: '전체 업무' },
    { view: 'my-tasks', icon: CheckSquare, label: '내 업무' },
    { view: 'notice', icon: Megaphone, label: '공지사항' },
    { view: 'messages', icon: MessageSquare, label: '메시지' },
    { view: 'kanban', icon: KanbanSquare, label: '칸반보드' },
    { view: 'calendar', icon: Calendar, label: '캘린더' },
    { view: 'documents', icon: FileText, label: '문서 관리' },
    { view: 'approval', icon: FileSignature, label: '전자결재' },
    { view: 'hr', icon: Clock, label: '근태 관리' },
    { view: 'crm', icon: Users, label: 'CRM' },
    { view: 'marketing', icon: Target, label: '마케팅' },
    { view: 'finance', icon: Wallet, label: '재무 관리' },
    { view: 'analytics', icon: BarChart2, label: '데이터 분석' },
    { view: 'admin', icon: Settings, label: '임직원 관리' }
  );

  return items;
};

export default function DashboardLayout({ currentView, onNavigate }: DashboardLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    '본사 콘솔': false
  });
  const { user, userProfile, isAdmin, isHQAdmin, signOut } = useAuth();
  const [companyName, setCompanyName] = useState('넥스트워크');
  const [companyLogo, setCompanyLogo] = useState<string | null>(nextworkLogo);
  
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  let navItems = getNavItems(isHQAdmin);
  if (!isAdmin && userProfile?.allowedMenus) {
    const allowed = userProfile.allowedMenus;
    navItems = navItems.map(item => {
      if (item.subItems) {
        return { ...item, subItems: item.subItems.filter(sub => allowed.includes(sub.view)) };
      }
      return item;
    }).filter(item => {
      if (item.subItems) {
        return item.subItems.length > 0;
      }
      return item.view && (allowed.includes(item.view) || (item.view === 'all-tasks' && allowed.includes('my-tasks')));
    });
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user || (!userProfile?.companyCode && !isHQAdmin)) return;
    
    // If no company code is bound yet (e.g. newly created HQ admin before applying a code)
    if (!userProfile?.companyCode) {
      setCompanyName('넥스트워크 본사 관리 (코드 미적용)');
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'company_codes', userProfile.companyCode), (docInfo) => {
      if (docInfo.exists()) {
        setCompanyName(docInfo.data().companyName || '넥스트워크');
        setCompanyLogo(docInfo.data().companyLogo || nextworkLogo);
      } else {
        setCompanyName('넥스트워크');
        setCompanyLogo(nextworkLogo);
      }
    }, (error: any) => {
      if (error.code !== 'permission-denied') {
        console.warn("Company info subscription warning:", error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, userProfile?.companyCode, isHQAdmin]);

  return (
    <div className="min-h-screen bg-surface-light flex font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-navy-900 border-r border-navy-800 text-gray-300">
        <div className="h-16 flex justify-between items-center px-6 border-b border-navy-800">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (isAdmin) {
                setIsCompanySettingsOpen(true);
              } else {
                onNavigate('landing');
              }
            }}
            title={isAdmin ? "회사 정보 설정" : "랜딩 페이지로 이동"}
          >
            {companyLogo ? (
              <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">
                <img src={companyLogo} alt={companyName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold text-sm shrink-0">{companyName.charAt(0).toUpperCase()}</div>
            )}
            <span className="text-lg font-bold text-white tracking-tight">{companyName}</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item, index) => {
            if (item.subItems) {
              const isActive = item.subItems.some(sub => sub.view === currentView);
              return (
                <div key={index} className="mb-2">
                  <button
                    onClick={() => setExpandedMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }))}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all group",
                      isActive
                        ? "bg-brand-500/10 text-brand-400"
                        : "text-brand-300 hover:bg-navy-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-brand-500" : "text-brand-400 group-hover:text-white")} />
                      {item.label}
                    </div>
                    {expandedMenus[item.label] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expandedMenus[item.label] && (
                    <div className="pl-11 pr-3 py-2 space-y-1">
                      {item.subItems.map((sub) => (
                        <button
                          key={sub.view}
                          onClick={() => onNavigate(sub.view as ViewState)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all",
                            currentView === sub.view
                              ? "bg-brand-500/20 text-white"
                              : "text-gray-400 hover:bg-navy-800 hover:text-gray-200"
                          )}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view as ViewState)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                  currentView === item.view 
                    ? "bg-brand-500/10 text-brand-400" 
                    : "hover:bg-navy-800 hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5", currentView === item.view ? "text-brand-500" : "text-gray-400 group-hover:text-white")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-navy-800">
          <button 
            onClick={() => onNavigate('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              currentView === 'settings' 
                ? "bg-brand-500/10 text-brand-400" 
                : "text-gray-300 hover:bg-navy-800 hover:text-white"
            )}
          >
            <Settings className={cn("w-5 h-5", currentView === 'settings' ? "text-brand-500" : "text-gray-400")} />
            설정
          </button>
          <div className="mt-4 flex items-center gap-3 px-3 py-2">
            <img src={userProfile?.photoURL || user?.photoURL || "https://i.pravatar.cc/150"} alt="User" className="w-8 h-8 object-cover rounded-full border border-navy-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userProfile?.name || user?.displayName || '사용자'}</p>
              <p className="text-xs text-brand-400 truncate">{user?.email || ''}</p>
            </div>
            <button onClick={signOut} title="로그아웃" className="p-2 text-gray-400 hover:text-red-400 transition-all bg-navy-800 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-navy-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-navy-900 hidden sm:block">
              {navItems.flatMap(i => i.subItems ? i.subItems : [{ view: i.view || '', label: i.label }]).find(i => i.view === currentView)?.label || companyName}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <HQCompanySwitcher />
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-400 border border-gray-200 px-3 sm:px-4 py-2 rounded-lg text-sm transition-colors w-10 sm:w-64"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:block whitespace-nowrap">플랫폼 검색 (Cmd+K)</span>
            </button>
            
            <NotificationBell onNavigate={onNavigate} />
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 sm:h-[calc(100vh-64px)]">
          <div className="max-w-7xl mx-auto h-full">
            {currentView === 'dashboard' && <DashboardHome />}
            {currentView === 'projects' && (
               <ProjectListView 
                 companyCode={userProfile?.companyCode || user?.uid || ''} 
                 onSelectProject={(p) => {
                   setSelectedProject(p);
                   onNavigate('project-detail' as ViewState);
                 }} 
               />
            )}
            {currentView === 'project-detail' && selectedProject && (
               <ProjectDashboardView 
                 project={selectedProject} 
                 onBack={() => onNavigate('projects' as ViewState)} 
               />
            )}
            {currentView === 'my-tasks' && (
              <KanbanBoard 
                mode="my"
                onSelectProject={(p) => {
                  setSelectedProject(p);
                  onNavigate('project-detail' as ViewState);
                }}
              />
            )}
            {currentView === 'all-tasks' && (
              <KanbanBoard 
                mode="all"
                onSelectProject={(p) => {
                  setSelectedProject(p);
                  onNavigate('project-detail' as ViewState);
                }}
              />
            )}
            {currentView === 'project-todo' && (
              <KanbanBoard 
                projectId={selectedProject?.id}
                mode="my"
                embedded
                onSelectProject={(p) => {
                  setSelectedProject(p);
                  onNavigate('project-detail' as ViewState);
                }}
              />
            )}
            {currentView === 'messages' && <MessagesView />}
            {(currentView === 'kanban' || currentView === 'project-tasks') && <KanbanBoard />}
            {(currentView === 'calendar' || currentView === 'project-schedule') && <CalendarView />}
            {(currentView === 'documents' || currentView === 'project-blog') && <DocumentsView />}
            {currentView === 'crm' && <CRMView />}
            {currentView === 'approval' && <ApprovalView />}
            {currentView === 'hr' && <HRView />}
            {currentView === 'marketing' && <MarketingView />}
            {currentView === 'finance' && <FinanceView />}
            {currentView === 'analytics' && <AnalyticsView />}
            {currentView === 'notice' && <NoticeView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'admin' && <AdminView />}
            {currentView === 'hq-subscriptions' && isHQAdmin && <HQSubscriptionsView />}
            {currentView === 'hq-codes' && isHQAdmin && <HQCodesView />}
            {currentView.startsWith('hq-') && currentView !== 'hq-subscriptions' && currentView !== 'hq-codes' && isHQAdmin && <HQPlaceholderView viewName={navItems.flatMap(i => i.subItems ? i.subItems : [{ view: i.view || '', label: i.label }]).find(sub => sub.view === currentView)?.label || ''} />}
          </div>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-64 bg-navy-900 h-full flex flex-col pt-5 pb-4">
            <button 
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div 
              className="px-6 pb-6 border-b border-navy-800 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                if (isAdmin) {
                  setIsCompanySettingsOpen(true);
                  setIsMobileMenuOpen(false);
                } else {
                  onNavigate('landing');
                  setIsMobileMenuOpen(false);
                }
              }}
            >
               {companyLogo ? (
                 <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">
                   <img src={companyLogo} alt={companyName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                 </div>
               ) : (
                 <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold text-sm shrink-0">{companyName.charAt(0).toUpperCase()}</div>
               )}
               <span className="text-lg font-bold text-white tracking-tight">{companyName}</span>
            </div>
             <nav className="flex-1 py-6 px-3 space-y-1">
              {navItems.map((item, index) => {
                if (item.subItems) {
                  const isActive = item.subItems.some(sub => sub.view === currentView);
                  return (
                    <div key={index} className="mb-2">
                      <button
                        onClick={() => setExpandedMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }))}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                          isActive
                            ? "bg-brand-500/10 text-brand-400"
                            : "text-brand-300 hover:bg-navy-800 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          {item.label}
                        </div>
                        {expandedMenus[item.label] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {expandedMenus[item.label] && (
                        <div className="pl-11 pr-3 py-2 space-y-1 flex flex-col items-start w-full">
                          {item.subItems.map((sub) => (
                            <button
                              key={sub.view}
                              onClick={() => {
                                onNavigate(sub.view as ViewState);
                                setIsMobileMenuOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                currentView === sub.view
                                  ? "bg-brand-500/20 text-white"
                                  : "text-gray-400 hover:bg-navy-800 hover:text-gray-200"
                              )}
                            >
                              {sub.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.view}
                    onClick={() => {
                      onNavigate(item.view as ViewState);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      currentView === item.view 
                        ? "bg-brand-500/10 text-brand-400" 
                        : "text-gray-300 hover:bg-navy-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-navy-800">
              <button 
                onClick={() => {
                  onNavigate('settings');
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-2",
                  currentView === 'settings' 
                    ? "bg-brand-500/10 text-brand-400" 
                    : "text-gray-300 hover:bg-navy-800 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Settings className={cn("w-5 h-5", currentView === 'settings' ? "text-brand-500" : "text-gray-400")} />
                  <span>설정</span>
                </div>
              </button>
              <button onClick={signOut} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-navy-800 hover:text-red-400 transition-colors">
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5" />
                  <span>로그아웃</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      
      {/* Company Settings Modal */}
      <CompanySettingsModal 
        isOpen={isCompanySettingsOpen} 
        onClose={() => setIsCompanySettingsOpen(false)} 
        currentName={companyName}
        currentLogo={companyLogo}
      />
    </div>
  );
}
