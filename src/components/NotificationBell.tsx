import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, AtSign, MessageSquare, X } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import { ViewState } from '../App';

interface Notification {
  id: string;
  userId: string;
  type: string;
  fromUserId: string;
  fromName: string;
  taskId: string;
  taskTitle?: string;
  content: string;
  read: boolean;
  createdAt: number;
  // Optional routing hint (used by channel/message notifications).
  link?: ViewState;
}

// Human-friendly relative time (ko).
function timeAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NotificationBell({
  onNavigate,
}: {
  onNavigate: (view: ViewState) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = Date.now();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notification[];
        data.sort((a, b) => b.createdAt - a.createdAt);
        setItems(data.slice(0, 30));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'),
    );
    return () => unsub();
  }, [user]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = items.filter((n) => !n.read);
  const unreadCount = unread.length;

  const markRead = async (n: Notification) => {
    if (n.read) return;
    try {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const handleClick = (n: Notification) => {
    markRead(n);
    setOpen(false);
    // Route to the most relevant view for the notification type.
    if (n.link) {
      onNavigate(n.link);
    } else if (n.type === 'message' || n.type === 'channel') {
      onNavigate('messages');
    } else {
      onNavigate('all-tasks');
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          open
            ? 'text-navy-900 bg-gray-100'
            : 'text-gray-400 hover:text-navy-900 hover:bg-gray-50',
        )}
        title="알림"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-navy-900">알림</span>
              {unreadCount > 0 && (
                <span className="bg-red-50 text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 transition"
                >
                  <Check className="w-3.5 h-3.5" /> 모두 읽음
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-300 hover:text-gray-500 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                새로운 알림이 없습니다.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full flex gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors',
                    n.read ? 'hover:bg-gray-50' : 'bg-brand-50/40 hover:bg-brand-50',
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 shrink-0 rounded-full flex items-center justify-center',
                      n.type === 'message' || n.type === 'channel'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-brand-100 text-brand-600',
                    )}
                  >
                    {n.type === 'message' || n.type === 'channel' ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : (
                      <AtSign className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-navy-900 truncate">
                        {n.fromName || '알림'}
                      </span>
                      {n.taskTitle ? (
                        <span className="text-[10px] text-gray-400 truncate">
                          · {n.taskTitle}
                        </span>
                      ) : null}
                      {!n.read && (
                        <span className="ml-auto w-2 h-2 bg-brand-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {n.type === 'mention' && (
                        <span className="text-brand-600 font-medium">회원님을 멘션했습니다: </span>
                      )}
                      {n.content}
                    </p>
                    <span className="text-[10px] text-gray-400">
                      {timeAgo(n.createdAt, now)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
