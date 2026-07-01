import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Hash, Lock, MessageSquare, Users as UsersIcon, UserPlus, Check } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import ChannelChat from './ChannelChat';

interface Channel {
  id: string;
  name: string;
  type?: 'channel' | 'dm';
  companyCode?: string;
  members?: string[];
  isPrivate?: boolean;
  createdBy?: string;
  userId?: string;
  createdAt: number;
  lastMessageAt?: number;
  lastMessageText?: string;
}

const userLabel = (u: any) =>
  u?.name || u?.displayName || u?.email || '이름 없음';

export default function MessagesView() {
  const { user, userProfile } = useAuth();
  const companyCode = userProfile?.companyCode || user?.uid || '';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [reads, setReads] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [modal, setModal] = useState<null | 'channel' | 'dm' | 'invite'>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  // Company members (for mentions + starting DMs).
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), where('companyCode', '==', companyCode));
    const unsub = onSnapshot(
      q,
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
    );
    return () => unsub();
  }, [user, companyCode]);

  // Channels & DMs for this company.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('companyCode', '==', companyCode));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Channel[];
        setChannels(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'chats'),
    );
    return () => unsub();
  }, [user, companyCode]);

  // My read markers.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'channelReads'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          map[data.chatId] = data.lastReadAt || 0;
        });
        setReads(map);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'channelReads'),
    );
    return () => unsub();
  }, [user]);

  // Only show channels, plus DMs I'm a member of.
  const visible = useMemo(() => {
    if (!user) return [];
    return channels
      .filter((c) =>
        c.type === 'dm'
          ? (c.members || []).includes(user.uid)
          : c.type === 'channel' &&
            (!c.isPrivate || (c.members || []).includes(user.uid)),
      )
      .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
  }, [channels, user]);

  const channelList = visible.filter((c) => c.type !== 'dm');
  const dmList = visible.filter((c) => c.type === 'dm');

  // Resolve a DM's display name to the other participant.
  const dmName = (c: Channel) => {
    const otherId = (c.members || []).find((m) => m !== user?.uid);
    const other = members.find((m) => m.id === otherId);
    return other ? userLabel(other) : c.name;
  };

  const displayName = (c: Channel) => (c.type === 'dm' ? dmName(c) : c.name);

  const filtered = (list: Channel[]) =>
    list.filter((c) => displayName(c).toLowerCase().includes(searchTerm.toLowerCase()));

  const isUnread = (c: Channel) =>
    c.id !== activeId &&
    !!c.lastMessageAt &&
    c.lastMessageAt > (reads[c.id] || 0);

  // Default-select the first available conversation.
  useEffect(() => {
    if (!activeId && visible.length > 0) setActiveId(visible[0].id);
  }, [visible, activeId]);

  const activeChannel = visible.find((c) => c.id === activeId) || null;

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChannelName.trim()) return;
    const id = doc(collection(db, 'chats')).id;
    try {
      await setDoc(doc(db, 'chats', id), {
        name: newChannelName.trim(),
        type: 'channel',
        companyCode,
        members: [user.uid],
        isPrivate: newChannelPrivate,
        createdBy: user.uid,
        userId: user.uid,
        createdAt: Date.now(),
      });
      setNewChannelName('');
      setNewChannelPrivate(false);
      setModal(null);
      setActiveId(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const startDM = async (other: any) => {
    if (!user) return;
    // Reuse an existing DM with this person if one exists.
    const existing = channels.find(
      (c) =>
        c.type === 'dm' &&
        (c.members || []).includes(user.uid) &&
        (c.members || []).includes(other.id),
    );
    if (existing) {
      setActiveId(existing.id);
      setModal(null);
      return;
    }
    const id = doc(collection(db, 'chats')).id;
    try {
      await setDoc(doc(db, 'chats', id), {
        name: `${userLabel(other)}님과의 대화`,
        type: 'dm',
        companyCode,
        members: [user.uid, other.id],
        createdBy: user.uid,
        userId: user.uid,
        createdAt: Date.now(),
      });
      setActiveId(id);
      setModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const inviteMember = async (channelId: string, memberId: string) => {
    try {
      await updateDoc(doc(db, 'chats', channelId), {
        members: arrayUnion(memberId),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'chats');
    }
  };

  const renderRow = (c: Channel) => {
    const unread = isUnread(c);
    return (
      <button
        key={c.id}
        onClick={() => setActiveId(c.id)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
          activeId === c.id ? 'bg-brand-50 text-navy-900' : 'hover:bg-gray-100 text-gray-600',
        )}
      >
        {c.type === 'dm' ? (
          <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
            {displayName(c).charAt(0)}
          </span>
        ) : c.isPrivate ? (
          <Lock className="w-4 h-4 shrink-0 text-gray-400" />
        ) : (
          <Hash className="w-4 h-4 shrink-0 text-gray-400" />
        )}
        <span className={cn('flex-1 truncate text-sm', unread && 'font-bold text-navy-900')}>
          {displayName(c)}
        </span>
        {unread && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0" />}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden h-[calc(100vh-8rem)] min-h-[600px]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-100 flex flex-col bg-gray-50/40">
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-navy-900">메시지</h2>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">채널</span>
              <button
                onClick={() => setModal('channel')}
                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition"
                title="채널 만들기"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {filtered(channelList).map((c) => renderRow(c))}
            {channelList.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">채널이 없습니다.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                다이렉트 메시지
              </span>
              <button
                onClick={() => setModal('dm')}
                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition"
                title="대화 시작"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {filtered(dmList).map((c) => renderRow(c))}
            {dmList.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">진행 중인 대화가 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {activeChannel ? (
          <>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              {activeChannel.type === 'dm' ? (
                <MessageSquare className="w-4 h-4 text-indigo-500" />
              ) : activeChannel.isPrivate ? (
                <Lock className="w-4 h-4 text-gray-400" />
              ) : (
                <Hash className="w-4 h-4 text-gray-400" />
              )}
              <h3 className="font-bold text-navy-900">{displayName(activeChannel)}</h3>
              {activeChannel.type !== 'dm' && (
                <span className="text-xs text-gray-400">
                  · {(activeChannel.members || []).length}명
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ChannelChat
                channelId={activeChannel.id}
                channelName={displayName(activeChannel)}
                users={members}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-12 h-12 mb-4 text-gray-200" />
            <p className="text-sm">채널을 선택하거나 새로 만들어보세요.</p>
          </div>
        )}
      </div>

      {/* Create channel modal */}
      {modal === 'channel' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">채널 만들기</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel}>
              <div className="relative mb-3">
                <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="예: 마케팅-팀"
                  className="w-full border-gray-200 rounded-xl pl-9 pr-4 py-2 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newChannelPrivate}
                  onChange={(e) => setNewChannelPrivate(e.target.checked)}
                  className="rounded"
                />
                <Lock className="w-3.5 h-3.5" /> 비공개 채널로 설정
              </label>
              <button
                type="submit"
                className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600"
              >
                만들기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Start DM modal */}
      {modal === 'dm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-brand-500" /> 대화 상대 선택
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-1">
              {members.filter((m) => m.id !== user?.uid).length === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">다른 임직원이 없습니다.</p>
              )}
              {members
                .filter((m) => m.id !== user?.uid)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => startDM(m)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                      {userLabel(m).charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{userLabel(m)}</p>
                      {m.department && (
                        <p className="text-xs text-gray-400 truncate">{m.department}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
