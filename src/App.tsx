import React, { useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import ProfileSetupView from './components/ProfileSetupView';
import { useAuth } from './lib/AuthContext';

export type ViewState = 'landing' | 'projects' | 'project-detail' | 'dashboard' | 'my-tasks' | 'project-blog' | 'project-tasks' | 'project-schedule' | 'project-todo' | 'kanban' | 'calendar' | 'crm' | 'finance' | 'admin' | 'messages' | 'documents' | 'analytics' | 'notice' | 'hr' | 'approval' | 'marketing' | 'settings' | 'hq-dashboard' | 'hq-plans' | 'hq-subscriptions' | 'hq-payments' | 'hq-sales' | 'hq-tenants' | 'hq-modules' | 'hq-sidebar' | 'hq-audit' | 'hq-system' | 'hq-status' | 'hq-security';

export default function App() {
  const [currentView, setCurrentView] = React.useState<ViewState>('landing');
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    if (user && userProfile?.isProfileComplete && currentView === 'landing') {
      setCurrentView('dashboard');
    } else if (!user) {
      setCurrentView('landing');
    }
  }, [user, userProfile]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-light">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (currentView === 'landing' || !user) {
    return <LandingPage onNavigate={setCurrentView} />;
  }

  if (user && userProfile && !userProfile.isProfileComplete) {
    return <ProfileSetupView />;
  }

  return <DashboardLayout currentView={currentView} onNavigate={setCurrentView} />;
}
