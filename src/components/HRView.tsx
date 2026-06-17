import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Clock, Play, Square, CheckCircle, Plus, X, Trash2, 
  MapPin, Radio, Layers, AlertTriangle, ShieldCheck, ChevronRight,
  Send, Users, List, Settings, Download, Calendar, Activity, RefreshCw 
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addDays } from 'date-fns';
import { useModal } from '../lib/ModalContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

const MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(MAPS_API_KEY) && MAPS_API_KEY !== 'YOUR_API_KEY';

interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  authType: string;
  latitude?: number | null;
  longitude?: number | null;
  ipAddress?: string;
  status: string; // '근무중', '퇴근', '지각', '결근'
  workHours?: number;
  locationVerified?: boolean;
  ipVerified?: boolean;
  createdAt: number;
}

interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: string; // '연차', '반차', '연장근무', '병가', '공가'
  startDate: string;
  endDate: string;
  reason: string;
  status: string; // 'pending', 'approved', 'rejected'
  companyCode: string;
  createdAt: number;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  displayName?: string | null;
  department?: string | null;
  companyCode?: string | null;
  role?: string;
  clockState?: string;
  clockTime?: string;
}

interface WorkPolicy {
  companyCode: string;
  standardIn: string;
  standardOut: string;
  weeklyHours: number;
  officeLatitude?: number;
  officeLongitude?: number;
  allowedIp?: string;
  policyType?: string;
}

export default function HRView() {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  
  // Current tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'apply' | 'monitor' | 'settings'>('dashboard');

  // Core Data States
  const [records, setRecords] = useState<Attendance[]>([]);
  const [allCompanyRecords, setAllCompanyRecords] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [policy, setPolicy] = useState<WorkPolicy | null>(null);

  // Loading states
  const [isGeolocationSupported, setIsGeolocationSupported] = useState(true);
  const [currentIp, setCurrentIp] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Form states (Apply leave/overtime)
  const [leaveType, setLeaveType] = useState('연차');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Form states (Work Policy Settings)
  const [standardIn, setStandardIn] = useState('09:00');
  const [standardOut, setStandardOut] = useState('18:00');
  const [weeklyHours, setWeeklyHours] = useState(40);
  const [officeLat, setOfficeLat] = useState('37.5665');
  const [officeLon, setOfficeLon] = useState('126.9780');
  const [allowedIp, setAllowedIp] = useState('121.254.12.3');
  const [policyType, setPolicyType] = useState('시차출퇴근');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // Filter state for CSV export
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  // 1. Fetch current User Profile to get Company Code and Role
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setCurrentUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
      }
    }, error => handleFirestoreError(error, OperationType.GET, 'users'));
    return () => unsub();
  }, [user]);

  const companyCode = currentUserProfile?.companyCode || '';
  const isAdminUser = currentUserProfile?.role === 'admin' || currentUserProfile?.email === 'info@nextin.ai.kr';

  // 2. Fetch User's Own Attendance Records
  useEffect(() => {
    if (!user) return;
    const qOwn = query(collection(db, 'attendances'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(qOwn, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];
      data.sort((a,b) => b.date.localeCompare(a.date));
      setRecords(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'attendances'));
    return () => unsubscribe();
  }, [user]);

  // 3. Fetch Company-wide Attendance Records (for manager/admin view)
  useEffect(() => {
    if (!companyCode || !user) return;
    const qComp = query(collection(db, 'attendances'), where('companyCode', '==', companyCode));
    const unsubscribe = onSnapshot(qComp, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];
      setAllCompanyRecords(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'attendances'));
    return () => unsubscribe();
  }, [companyCode, user]);

  // 4. Fetch Leave Requests for company
  useEffect(() => {
    if (!companyCode || !user) return;
    const qLeaves = query(collection(db, 'leaves'), where('companyCode', '==', companyCode));
    const unsubscribe = onSnapshot(qLeaves, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeaveRequest[];
      data.sort((a,b) => b.createdAt - a.createdAt);
      setLeaveRequests(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'leaves'));
    return () => unsubscribe();
  }, [companyCode, user]);

  // 5. Fetch Company Members
  useEffect(() => {
    if (!companyCode || !user) return;
    const qUsers = query(collection(db, 'users'), where('companyCode', '==', companyCode));
    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserProfile[];
      setCompanyUsers(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [companyCode, user]);

  // 6. Fetch company work policies
  useEffect(() => {
    if (!companyCode || !user) return;
    const unsub = onSnapshot(doc(db, 'work_policies', companyCode), (snap) => {
      if (snap.exists()) {
        const p = snap.data() as WorkPolicy;
        setPolicy(p);
        setStandardIn(p.standardIn || '09:00');
        setStandardOut(p.standardOut || '18:00');
        setWeeklyHours(p.weeklyHours || 40);
        setOfficeLat(p.officeLatitude?.toString() || '37.5665');
        setOfficeLon(p.officeLongitude?.toString() || '126.9780');
        setAllowedIp(p.allowedIp || '121.254.12.3');
        setPolicyType(p.policyType || '시차출퇴근');
      }
    }, error => handleFirestoreError(error, OperationType.GET, 'work_policies'));
    return () => unsub();
  }, [companyCode, user]);

  // Geolocation awareness
  useEffect(() => {
    if (!navigator.geolocation) {
      setIsGeolocationSupported(false);
    }
  }, []);

  // Fetch Public IP on mount
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setCurrentIp(data.ip))
      .catch(() => setCurrentIp('121.254.12.3')); // default mock IP
  }, []);

  // IP/GPS Based Check-in
  const handleCheckInApi = async (authTypeSelected: 'GPS' | 'IP') => {
    if (!user) return;
    
    // Check if check-in already recorded
    const existing = records.find(r => r.date === todayDateStr);
    if (existing) {
      alert({ title: "알림", message: '이미 오늘의 출근 기록이 존재합니다.' });
      return;
    }

    setIsCheckingIn(true);

    const checkInFn = async (lat: number | null, lon: number | null) => {
      try {
        const response = await fetch('/api/attendance/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            latitude: lat,
            longitude: lon,
            ipAddress: currentIp,
            authType: authTypeSelected,
            companyCode: companyCode
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '출근 처리 중 오류가 발생했습니다.');
        }

        alert({ title: "성공", message: `출근 기록이 저장되었습니다. (${data.record.status})` });
      } catch (err: any) {
        alert({ title: "오류", message: err.message });
      } finally {
        setIsCheckingIn(false);
      }
    };

    if (authTypeSelected === 'GPS') {
      if (!navigator.geolocation) {
        alert({ title: "오류", message: "이 브라우저는 위치 정보(GPS)를 지원하지 않습니다." });
        setIsCheckingIn(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          checkInFn(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          alert({ title: "GPS 오류", message: "위치 정보 동의를 얻을 수 없거나 GPS 오류가 있습니다. 기기의 위치 서비스를 활성화 하거나 IP 기반 출근을 활용해 주세요." });
          setIsCheckingIn(false);
        }
      );
    } else {
      // IP check in
      checkInFn(null, null);
    }
  };

  // Check out API Call
  const handleCheckOutApi = async () => {
    if (!user) return;

    const existing = records.find(r => r.date === todayDateStr);
    if (!existing) {
      alert({ title: "알림", message: '지정일의 출근 기록이 없습니다. 먼저 신규 출근 등록을 해주세요.' });
      return;
    }
    if (existing.checkOut) {
      alert({ title: "알림", message: '이미 오늘의 퇴근 처리가 완료되었습니다.' });
      return;
    }

    setIsCheckingOut(true);

    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '퇴근 처리 중 오류가 발생했습니다.');
      }

      alert({ title: "퇴근 완료", message: `오늘의 퇴근 기록이 등록되었습니다. 근무 시간: ${data.workHours}시간` });
    } catch (err: any) {
      alert({ title: "오류", message: err.message });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!reason.trim()) {
      alert({ title: "입력 오류", message: "신청 사유를 상세하게 명시해 주세요." });
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const response = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: currentUserProfile?.name || currentUserProfile?.displayName || '직원',
          type: leaveType,
          startDate,
          endDate,
          reason: reason.trim(),
          companyCode: companyCode
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '신청 등록 중 실패했습니다.');
      }

      alert({ title: "성공", message: "휴가/연장근무 결재 요청 신청이 완료되었습니다." });
      setReason('');
    } catch (err: any) {
      alert({ title: "오류", message: err.message });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Handle Approve/Reject Leave Request
  const handleApproveLeave = async (id: string, status: 'approved' | 'rejected') => {
    confirm({
      title: '결재 처리',
      message: `이 기안을 실제로 ${status === 'approved' ? '승인' : '반려'} 처리하시겠습니까?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/leaves/approve/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '결재 상태 변경 중 에러가 발생했습니다.');
          }

          alert({ title: "처리 완료", message: `기안이 성공적으로 ${status === 'approved' ? '승인' : '반려'}되었습니다.` });
        } catch (err: any) {
          alert({ title: "결재 실패", message: err.message });
        }
      }
    });
  };

  // Save Corporate Work Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCode) return;

    setIsSavingPolicy(true);
    try {
      await setDoc(doc(db, 'work_policies', companyCode), {
        companyCode,
        standardIn,
        standardOut,
        weeklyHours: Number(weeklyHours),
        officeLatitude: Number(officeLat),
        officeLongitude: Number(officeLon),
        allowedIp,
        policyType,
        updatedAt: Date.now()
      });
      alert({ title: "저장 완료", message: "우리 기업 맞춤 근태 제도 설정이 안전하게 업데이트되었습니다." });
    } catch (err: any) {
      alert({ title: "저장 실패", message: err.message });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Set GPS to actual current browser location
  const handleSetToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOfficeLat(pos.coords.latitude.toFixed(6));
          setOfficeLon(pos.coords.longitude.toFixed(6));
          alert({ title: "성공", message: "현재 브라우저 위치 좌표를 위도/경도 필드에 동기화했습니다." });
        },
        (err) => {
          alert({ title: "오류", message: "현재 브라우저 위치 정보를 가져올 수 없습니다. 브라우저 위치 권한 승인이 필요합니다." });
        }
      );
    } else {
      alert({ title: "지원 안 됨", message: "이 브라우저는 위치 정보 서비스를 지원하지 않습니다." });
    }
  };

  // Report Download (CSV File)
  const handleDownloadCsv = () => {
    if (!companyCode) return;
    const url = `/api/admin/reports/csv?companyCode=${companyCode}&month=${exportMonth}`;
    window.open(url, '_blank');
  };

  // Calculated helper for current user's weekly working hours
  const getWeeklyWorkHoursChartData = () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
    
    // Generate dates mon ~ sun
    const daysInWeek = eachDayOfInterval({ start: monday, end: sunday });

    return daysInWeek.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const rec = records.find(r => r.date === dateStr);
      const dayKorean = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(day);
      return {
        name: `${format(day, 'M/d')} (${dayKorean})`,
        '근무시간 (H)': rec ? (rec.workHours || 0) : 0,
        normalHours: rec ? Math.min(rec.workHours || 0, 8) : 0,
        overHours: rec ? Math.max((rec.workHours || 0) - 8, 0) : 0
      };
    });
  };

  // Calculate Cumulative total hours for user this week
  const getMyCumulativeWeeklyHours = () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
    
    return records
      .filter(r => {
        const d = parseISO(r.date);
        return d >= monday && d <= sunday;
      })
      .reduce((sum, r) => sum + (r.workHours || 0), 0);
  };

  // Aggregate leave totals
  const totalAnnualLeaves = 15;
  const approvedLeavesList = leaveRequests.filter(l => l.userId === user?.uid && l.type === '연차' && l.status === 'approved');
  const consumedLeaves = approvedLeavesList.length; // Simple count where each 'approved' request counts as 1 day
  const remainingLeaves = totalAnnualLeaves - consumedLeaves;

  // Real-time Overview Dashboard stats for Today
  const getTodayMonitoringStats = () => {
    const todayRecs = allCompanyRecords.filter(r => r.date === todayDateStr);
    const totalCompanyStaffCount = companyUsers.length;

    const checkedInCount = todayRecs.length;
    const lateCount = todayRecs.filter(r => r.status === '지각').length;
    
    // Remote checks: if authType is IP/GPS but let's assume if distance > 500 meters or marked locationVerified false, count as Remote
    const remoteCount = todayRecs.filter(r => !r.locationVerified && r.latitude).length;
    const absentCount = Math.max(0, totalCompanyStaffCount - checkedInCount);

    return {
      checkedInCount,
      lateCount,
      remoteCount,
      absentCount,
      totalCompanyStaffCount
    };
  };

  // 52-Hour warnings calculator for each member
  const getStaffWeeklyReport = () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });

    return companyUsers.map(staff => {
      // Find staff records in current week
      const staffRecordsThisWeek = allCompanyRecords.filter(r => {
        if (r.userId !== staff.id) return false;
        const d = parseISO(r.date);
        return d >= monday && d <= sunday;
      });

      const totalHours = staffRecordsThisWeek.reduce((sum, r) => sum + (r.workHours || 0), 0);
      const isApproachingLimit = totalHours >= 45; // 45+ hrs is approaching 52 hrs threshold

      // Today status
      const todayRecord = allCompanyRecords.find(r => r.userId === staff.id && r.date === todayDateStr);
      let status = '미출근';
      if (todayRecord) {
        status = todayRecord.checkOut ? '퇴근' : todayRecord.status || '근무중';
      }

      return {
        id: staff.id,
        name: staff.name || staff.displayName || '이름 없음',
        dept: staff.department || '미지정',
        weeklyHours: Math.round(totalHours * 10) / 10,
        isApproachingLimit,
        todayStatus: status,
        todayRecord
      };
    });
  };

  const todayStats = getTodayMonitoringStats();
  const staffWeeklyReport = getStaffWeeklyReport();
  const todayRecord = records.find(r => r.date === todayDateStr);

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">통합 근태 및 근무제도 시스템</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              소속 회사 코드 : <span className="font-semibold text-brand-600">{companyCode}</span> | {currentUserProfile?.displayName || '직원'} 님
              {isAdminUser && <span className="ml-2 bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-sans">관리자 권한</span>}
            </p>
          </div>
        </div>

        {/* Tab Control */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
          >
            <Activity className="w-4 h-4" /> 직원 대시보드
          </button>
          <button
            onClick={() => setActiveTab('apply')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'apply' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
          >
            <Send className="w-4 h-4" /> 연차/휴가 신청
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'monitor' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
          >
            <Users className="w-4 h-4" /> 실시간 모니터링
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
          >
            <Settings className="w-4 h-4" /> 제도 설정 및 승인
          </button>
        </div>
      </div>

      {/* TAB 1: Employee main dashboard */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Attendance operations */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm font-medium">{format(new Date(), 'yyyy년 MM월 dd일')}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-mono">{currentIp}</span>
              </div>
              <h2 className="text-lg font-bold text-navy-900 mt-2">오늘의 근태 체크</h2>
              <p className="text-gray-500 text-xs mt-1">
                기업에 설정된 방식을 통해 출근을 등록해 주세요. GPS 출근 시 지정 사무실 반경 내 인증이 요구됩니다.
              </p>
            </div>

            {/* Check-in/out State buttons */}
            <div className="bg-brand-50/45 p-5 rounded-2xl border border-brand-100 flex flex-col items-center justify-center space-y-5">
              <div className="text-center font-sans">
                <span className="text-gray-500 text-xs block">현재 출근 상태</span>
                <span className={`text-xl font-black mt-1 inline-block ${todayRecord ? 'text-green-600' : 'text-gray-400'}`}>
                  {todayRecord ? `${todayRecord.status} (${todayRecord.checkIn})` : '미출근 상태'}
                </span>
                {todayRecord?.checkOut && (
                  <span className="text-sm text-gray-500 block">퇴근 완료: {todayRecord.checkOut}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleCheckInApi('GPS')}
                  disabled={!!todayRecord || isCheckingIn}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border border-transparent font-medium text-xs gap-1 cursor-pointer transition-all ${
                    todayRecord 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span>GPS 출근</span>
                </button>

                <button
                  onClick={() => handleCheckInApi('IP')}
                  disabled={!!todayRecord || isCheckingIn}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border border-transparent font-medium text-xs gap-1 cursor-pointer transition-all ${
                    todayRecord 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                  }`}
                >
                  <Radio className="w-5 h-5" />
                  <span>사내 IP 출근</span>
                </button>
              </div>

              <button
                onClick={handleCheckOutApi}
                disabled={!todayRecord || !!todayRecord.checkOut || isCheckingOut}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all text-sm shadow-sm ${
                  (!todayRecord || !!todayRecord.checkOut) 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                <Square className="w-4 h-4 fill-current" />
                <span>퇴근하기</span>
              </button>
            </div>

            {/* Remaining Leave Status Board */}
            <div className="bg-slate-50 border border-gray-100 p-5 rounded-2xl">
              <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand-500" /> 잔여 연차 현황판
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">기본 연차</span>
                  <span className="text-base font-bold text-gray-800">{totalAnnualLeaves}일</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">사용 연차</span>
                  <span className="text-base font-bold text-red-500">{consumedLeaves}일</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-brand-100 bg-brand-50/20">
                  <span className="text-[10px] text-brand-600 block font-bold">잔여 연차</span>
                  <span className="text-base font-extrabold text-brand-700">{remainingLeaves}일</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cumulative weekly hours chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-navy-900">이번 주 누적 근무 현황</h2>
                  <p className="text-gray-500 text-xs">주 최대 52시간 규정 준수 통계 그래프</p>
                </div>
                <div className="bg-slate-50 border border-gray-200 px-4 py-2 rounded-xl text-right">
                  <span className="text-[10px] text-gray-500 block font-semibold">이번 주 총 누적 근무</span>
                  <span className="text-lg font-black text-brand-600 font-sans">{getMyCumulativeWeeklyHours()} / 52 H</span>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-64 mt-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getWeeklyWorkHoursChartData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                    <YAxis fontSize={11} stroke="#94a3b8" unit="H" domain={[0, 12]} />
                    <Tooltip formatter={(value) => [`${value}시간`, '근무 시간']} />
                    <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="기본 근무 (8H 이하)" dataKey="normalHours" stackId="hours" fill="#4f46e5" radius={[2, 2, 0, 0]} />
                    <Bar name="연장 근무 (8H 초과)" dataKey="overHours" stackId="hours" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Attendance Log table preview */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-navy-900">최근 5일 나의 근태 기록</span>
                <span className="text-xs text-gray-400">총 기록 {records.length}건</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-2.5 px-3 font-semibold text-gray-500">날짜</th>
                      <th className="py-2.5 px-3 font-semibold text-gray-500">출근시간</th>
                      <th className="py-2.5 px-3 font-semibold text-gray-500">퇴근시간</th>
                      <th className="py-2.5 px-3 font-semibold text-gray-500">근무시간</th>
                      <th className="py-2.5 px-3 font-semibold text-gray-500">인증수단</th>
                      <th className="py-2.5 px-3 font-semibold text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="py-2.5 px-3 font-medium text-navy-900">{r.date}</td>
                        <td className="py-2.5 px-3 text-gray-600">{r.checkIn}</td>
                        <td className="py-2.5 px-3 text-gray-600">{r.checkOut || '-'}</td>
                        <td className="py-2.5 px-3 font-bold text-indigo-600">{r.workHours !== undefined ? `${r.workHours}H` : '-'}</td>
                        <td className="py-2.5 px-3 text-gray-600 flex items-center gap-1">
                          {r.authType === 'GPS' ? <MapPin className="w-3 h-3 text-amber-500" /> : <Radio className="w-3 h-3 text-indigo-500" />}
                          {r.authType}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === '지각' ? 'bg-amber-100 text-amber-800' :
                            r.status === '퇴근' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-400">등록된 출근 기록이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Employee request page */}
      {activeTab === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Apply Form */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-500" /> 휴가 및 연장 근무 신청 기안
            </h2>
            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">기안 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {['연차', '반차', '연장근무'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLeaveType(type)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${leaveType === type ? 'bg-brand-500 text-white border-brand-500 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    required
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">사유</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="예) 가사 사정으로 인한 연차 신청, 프로젝트 마감 기한 엄수를 위한 야간 고정 연장근무 등"
                  required
                  rows={4}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLeave}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" /> 기안 접수하기
              </button>
            </form>
          </div>

          {/* Request list */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                <List className="w-5 h-5 text-indigo-500" /> 나의 신청 및 결재 내역 리스트
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-3 px-4 font-semibold text-gray-500">신청일</th>
                      <th className="py-3 px-4 font-semibold text-gray-500">결재 유형</th>
                      <th className="py-3 px-4 font-semibold text-gray-500">기간</th>
                      <th className="py-3 px-4 font-semibold text-gray-500 w-1/3">사유 및 세부내역</th>
                      <th className="py-3 px-4 font-semibold text-gray-500">결재 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.filter(l => l.userId === user?.uid).map(leave => (
                      <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="py-3 px-4 text-gray-500">{format(leave.createdAt, 'yyyy-MM-dd')}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            leave.type === '연차' ? 'bg-brand-50 text-brand-700' :
                            leave.type === '반차' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {leave.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-navy-900">{leave.startDate} ~ {leave.endDate}</td>
                        <td className="py-3 px-4 text-gray-600 font-sans truncate max-w-xs">{leave.reason}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold font-sans ${
                            leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                            leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {leave.status === 'approved' ? '승인' : leave.status === 'rejected' ? '반려' : '결재대기'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leaveRequests.filter(l => l.userId === user?.uid).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">접수된 휴가/근무 신청이 존재하지 않습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Manager Real-time Monitoring */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {/* Today stats overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-semibold block">금일 현재 출근자</span>
                <span className="text-2xl font-black text-indigo-600 mt-1 block font-sans">
                  {todayStats.checkedInCount} / {todayStats.totalCompanyStaffCount}명
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-semibold block">지각자 수</span>
                <span className="text-2xl font-black text-amber-600 mt-1 block font-sans">
                  {todayStats.lateCount}명
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-semibold block">외근 및 재택</span>
                <span className="text-2xl font-black text-teal-600 mt-1 block font-sans">
                  {todayStats.remoteCount}명
                </span>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <MapPin className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-semibold block">현재 미출근자</span>
                <span className="text-2xl font-black text-rose-600 mt-1 block font-sans">
                  {todayStats.absentCount}명
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <X className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* 52h Warning system */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold text-navy-900">우리 컴퍼니 임직원 주간 근무 모니터링</h2>
                <p className="text-gray-500 text-xs">근무시간이 주 52시간 규정 초과에 임박한 대상(45시간 이상)은 자동으로 강조 하이라이트됩니다.</p>
              </div>

              {/* CSV Export tool */}
              <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="font-semibold text-gray-600">대상월 :</span>
                <input
                  type="month"
                  value={exportMonth}
                  onChange={e => setExportMonth(e.target.value)}
                  className="bg-transparent border-0 outline-none font-sans"
                />
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 py-1 px-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
                >
                  <Download className="w-3.5 h-3.5" /> CSV 리포트 추출
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="py-3 px-4 font-semibold text-gray-500">임직원명</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">소속 부서</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">오늘 출근 상태</th>
                    <th className="py-3 px-4编制 font-semibold text-gray-500">출근 정보 (상세)</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">이번주 총 근무 시간</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">주 52시간 리스크 구분</th>
                  </tr>
                </thead>
                <tbody>
                  {staffWeeklyReport.map(report => (
                    <tr
                      key={report.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/40 transition ${
                        report.isApproachingLimit ? 'bg-red-50/20 hover:bg-red-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-navy-900">{report.name}</td>
                      <td className="py-3.5 px-4 text-gray-600">{report.dept}</td>
                      <td className="py-3.5 px-4 text-gray-600">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          report.todayStatus === '미출근' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                          report.todayStatus === '지각' ? 'bg-amber-100 text-amber-700' :
                          report.todayStatus === '퇴근' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                        }`}>
                          {report.todayStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-mono">
                        {report.todayRecord ? (
                          <>
                            {report.todayRecord.checkIn} ~ {report.todayRecord.checkOut || '(업무 중)'}
                            {report.todayRecord.authType && ` [${report.todayRecord.authType}]`}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-base text-navy-900 font-sans">
                        {report.weeklyHours} H
                      </td>
                      <td className="py-3.5 px-4">
                        {report.isApproachingLimit ? (
                          <div className="flex items-center gap-1.5 text-red-600 font-bold bg-white text-[11px] border border-red-200 shadow-sm px-2.5 py-1 rounded-lg w-max animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>위험 (52시간 임박)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600 font-bold text-[11px] bg-white border border-green-200 px-2.5 py-1 rounded-lg w-max">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>안전</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {staffWeeklyReport.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">우리 컴퍼니에 등록된 사원이 아직 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Manager Approvals & Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Corporate Work Policy Config Form */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" /> 컴퍼니 근태 제도 설정
              </h2>
              <form onSubmit={handleSavePolicy} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">근무 형태 유형</label>
                  <select
                    value={policyType}
                    onChange={e => setPolicyType(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="시차출퇴근">시차출퇴근제</option>
                    <option value="탄력근무">탄력근무제</option>
                    <option value="선택근무">선택적 소정근무제</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">표준 출근 시간 (H:M)</label>
                    <input
                      type="time"
                      value={standardIn}
                      onChange={e => setStandardIn(e.target.value)}
                      required
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">표준 퇴근 시간 (H:M)</label>
                    <input
                      type="time"
                      value={standardOut}
                      onChange={e => setStandardOut(e.target.value)}
                      required
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">주간 최대 소정근로 시간</label>
                  <input
                    type="number"
                    value={weeklyHours}
                    onChange={e => setWeeklyHours(Number(e.target.value))}
                    required
                    min={10}
                    max={52}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="block text-xs font-bold text-navy-950">GPS 인증 위치 설정 (사무실)</span>
                    <button
                      type="button"
                      onClick={handleSetToCurrentLocation}
                      className="text-[10px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg border border-brand-100 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" /> 내 현재 위치로 설정
                    </button>
                  </div>

                  {/* Google Maps View */}
                  {hasValidKey ? (
                    <div className="mb-3 rounded-xl overflow-hidden border border-gray-200 shadow-inner h-[220px] relative">
                      <APIProvider apiKey={MAPS_API_KEY} version="weekly">
                        <GoogleMap
                          defaultCenter={{ lat: Number(officeLat) || 37.5665, lng: Number(officeLon) || 126.9780 }}
                          center={{ lat: Number(officeLat) || 37.5665, lng: Number(officeLon) || 126.9780 }}
                          defaultZoom={15}
                          zoom={15}
                          mapId="DEMO_MAP_ID"
                          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          style={{ width: '100%', height: '100%' }}
                          onClick={(e) => {
                            const lat = e.detail.latLng?.lat;
                            const lng = e.detail.latLng?.lng;
                            if (lat && lng) {
                              setOfficeLat(lat.toFixed(6));
                              setOfficeLon(lng.toFixed(6));
                            }
                          }}
                        >
                          <AdvancedMarker
                            position={{ lat: Number(officeLat) || 37.5665, lng: Number(officeLon) || 126.9780 }}
                            draggable={true}
                            onDragEnd={(e) => {
                              const lat = e.latLng?.lat();
                              const lng = e.latLng?.lng();
                              if (lat && lng) {
                                setOfficeLat(lat.toFixed(6));
                                setOfficeLon(lng.toFixed(6));
                              }
                            }}
                          >
                            <Pin background="#4285F4" glyphColor="#fff" />
                          </AdvancedMarker>
                        </GoogleMap>
                      </APIProvider>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-[11px] text-amber-800 my-2 leading-relaxed space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Google Maps API Key가 설정되지 않았습니다.
                      </p>
                      <p>위치 지정을 시각적으로 사용하려면 우측 상단 ⚙️ 설정을 눌러 <b>Secrets</b> 메뉴에서 <code>GOOGLE_MAPS_PLATFORM_KEY</code> 이름으로 구글 지도 API 키값을 추가해주세요.</p>
                      <p className="text-gray-500 text-[10px]">※ API 키 등록 후 앱이 즉시 다시 빌드되어 지도가 활성화됩니다.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400">위도 (Latitude)</label>
                      <input
                        type="text"
                        value={officeLat}
                        onChange={e => setOfficeLat(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-mono outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-sans">경도 (Longitude) </label>
                      <input
                        type="text"
                        value={officeLon}
                        onChange={e => setOfficeLon(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-mono outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">
                    * 지도를 드래그하여 마커를 타겟 지점에 두고 지도를 원클릭하면 정확한 위경도가 자동 할당됩니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">사내 허용 IP주소 설정 (출근용)</label>
                  <input
                    type="text"
                    value={allowedIp}
                    onChange={e => setAllowedIp(e.target.value)}
                    placeholder="예) 121.254.12.3"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPolicy}
                  className="w-full py-2.5 bg-gray-900 border border-gray-950 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  제도 설정 적용하기
                </button>
              </form>
            </div>
          </div>

          {/* Leave approvals table */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" /> 사원 근태 및 연차 결재 대기 수목
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="py-3 px-4 font-semibold text-gray-500">기안일</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">기안 사원</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">유형</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">신청 기간</th>
                    <th className="py-3 px-4 font-semibold text-gray-500 w-1/4">사유</th>
                    <th className="py-3 px-4 font-semibold text-gray-500">상태</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-500">승인 처리</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map(leave => (
                    <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                      <td className="py-3 px-4 text-gray-400">{format(leave.createdAt, 'yyyy-MM-dd')}</td>
                      <td className="py-3 px-4 font-bold text-navy-900">{leave.userName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          leave.type === '연차' ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {leave.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-navy-900">{leave.startDate} ~ {leave.endDate}</td>
                      <td className="py-3 px-4 text-gray-600 truncate max-w-xs">{leave.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                          leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700 font-sans'
                        }`}>
                          {leave.status === 'approved' ? '승인완료' : leave.status === 'rejected' ? '반려됨' : '대기중'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {leave.status === 'pending' ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveLeave(leave.id, 'approved')}
                              className="px-2 py-1 bg-green-500 text-white rounded text-[10px] font-bold hover:bg-green-600 transition"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleApproveLeave(leave.id, 'rejected')}
                              className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600 transition"
                            >
                              반려
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">결재완료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leaveRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 font-sans">아직 사원들이 올린 결재 기안서가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
