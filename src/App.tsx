import React, { useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import { useAuth } from './lib/AuthContext';

export type ViewState = 'landing' | 'projects' | 'project-categories' | 'project-detail' | 'dashboard' | 'my-tasks' | 'all-tasks' | 'project-blog' | 'project-tasks' | 'project-schedule' | 'project-todo' | 'kanban' | 'calendar' | 'crm' | 'finance' | 'admin' | 'messages' | 'documents' | 'analytics' | 'notice' | 'hr' | 'approval' | 'marketing' | 'settings' | 'hq-dashboard' | 'hq-plans' | 'hq-subscriptions' | 'hq-payments' | 'hq-sales' | 'hq-tenants' | 'hq-modules' | 'hq-sidebar' | 'hq-audit' | 'hq-system' | 'hq-status' | 'hq-security' | 'hq-codes';

export default function App() {
  const [currentView, setCurrentView] = React.useState<ViewState>('landing');
  const { user, userProfile, isAdmin, isHQAdmin, loading } = useAuth();
  
  // Track the previous user state to detect true active logins vs cached sessions
  const prevUserRef = React.useRef<any>(undefined);

  useEffect(() => {
    if (loading) return;

    const isInitialAuthCheck = prevUserRef.current === undefined;
    const wasLoggedOut = prevUserRef.current === null;
    const isLoggedInNow = user !== null;

    if (isLoggedInNow) {
      if (isInitialAuthCheck) {
        // Initial visit with cached session: always land on 'landing' first
        // satisfying: "첫 페이지 접속시 프로필 정보 입력이 아니라 랜딩페이지로 접속해야합니다."
        setCurrentView('landing');
      } else if (wasLoggedOut) {
        // Active login event (transition from logged out to logged in):
        // satisfying: "로그인시 마이페이지로 이동합니다. 관리자는 관리자페이지로 이동합니다."
        if (userProfile || isHQAdmin) {
          if (isHQAdmin) {
            setCurrentView('hq-dashboard');
          } else if (isAdmin) {
            setCurrentView('admin');
          } else {
            setCurrentView('settings');
          }
        } else {
          setCurrentView('landing');
        }
      }
    } else {
      setCurrentView('landing');
    }

    prevUserRef.current = user;
  }, [user, userProfile, isAdmin, loading]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isLanding = currentView === 'landing' || !user;
    
    if (isLanding) {
      document.documentElement.classList.remove('dark');
    } else {
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [currentView, user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-light">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  // If we are currently on the landing page, always render LandingPage
  // (ensuring visiting the root domain displays landing page even if profile is incomplete)
  if (currentView === 'landing' || !user) {
    return <LandingPage onNavigate={setCurrentView} />;
  }

  return <DashboardLayout currentView={currentView} onNavigate={setCurrentView} />;
}
