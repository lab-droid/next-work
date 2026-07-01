import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import {
  Plus,
  Trash2,
  X,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  SmilePlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../lib/ModalContext';
import { cn } from '../lib/utils';
import TaskComments from './TaskComments';

interface Notice {
  id: string;
  userId: string;
  authorName?: string;
  companyCode?: string;
  title: string;
  content: string;
  readBy?: string[];
  reactions?: Record<string, string[]>;
  createdAt: number;
}

const REACTIONS = ['👍', '❤️', '🎉', '👀', '✅'];

const userLabel = (u: any) =>
  u?.name || u?.displayName || u?.email || '이름 없음';

function NoticeCard({
  notice,
  members,
  currentUid,
  onDelete,
}: {
  notice: Notice;
  members: any[];
  currentUid: string;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showReaders, setShowReaders] = useState(false);

  const readBy = notice.readBy || [];
  const hasRead = readBy.includes(currentUid);
  const readers = members.filter((m) => readBy.includes(m.id));
  const reactionEntries = Object.entries(notice.reactions || {}).filter(
    ([, uids]) => uids.length > 0,
  );

  // Mark as read the first time the announcement is opened.
  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !hasRead && currentUid) {
      try {
        await updateDoc(doc(db, 'notices', notice.id), {
          readBy: arrayUnion(currentUid),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'notices');
      }
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!currentUid) return;
    const current = notice.reactions?.[emoji] || [];
    const has = current.includes(currentUid);
    const nextUids = has
      ? current.filter((x) => x !== currentUid)
      : [...current, currentUid];
    const reactions = { ...(notice.reactions || {}) };
    if (nextUids.length) reactions[emoji] = nextUids;
    else delete reactions[emoji];
    try {
      await updateDoc(doc(db, 'notices', notice.id), { reactions });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notices');
    }
    setPickerOpen(false);
  };

  return (
    <div
      className={cn(
        'border rounded-xl transition-colors bg-white',
        hasRead ? 'border-gray-100' : 'border-brand-200 bg-brand-50/20',
      )}
    >
      {/* Header row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={handleToggle}
            className="mt-0.5 text-gray-400 hover:text-navy-900 transition"
          >
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={handleToggle}>
            <div className="flex items-center gap-2 flex-wrap">
              {!hasRead && (
                <span className="text-[10px] font-bold text-white bg-brand-500 px-1.5 py-0.5 rounded-full">
                  NEW
                </span>
              )}
              <h3 className="font-bold text-navy-900 text-base truncate">{notice.title}</h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span>{notice.authorName || '작성자'}</span>
              <span>·</span>
              <span>{format(notice.createdAt, 'yyyy-MM-dd')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Read receipts */}
            <div className="relative">
              <button
                onClick={() => setShowReaders((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-900 transition"
                title="읽은 사람"
              >
                <Eye className="w-3.5 h-3.5" />
                {readers.length}
              </button>
              {showReaders && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 max-h-56 overflow-y-auto">
                  <p className="text-[10px] text-gray-400 font-medium px-1 mb-1">
                    읽음 {readers.length} / {members.length}명
                  </p>
                  {readers.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-1">아직 읽은 사람이 없습니다.</p>
                  ) : (
                    readers.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-1 py-1">
                        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">
                          {userLabel(r).charAt(0)}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{userLabel(r)}</span>
                        <Check className="w-3 h-3 text-brand-500 ml-auto" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {notice.userId === currentUid && (
              <button
                onClick={() => onDelete(notice.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="pl-8 mt-3">
            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
              {notice.content}
            </p>

            {/* Reactions */}
            <div className="flex items-center gap-1 mt-4 flex-wrap">
              {reactionEntries.map(([emoji, uids]) => {
                const mine = uids.includes(currentUid);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(emoji)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition',
                      mine
                        ? 'bg-brand-50 border-brand-200 text-brand-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="font-medium">{uids.length}</span>
                  </button>
                );
              })}
              <div className="relative">
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  title="반응 추가"
                >
                  <SmilePlus className="w-4 h-4" />
                </button>
                {pickerOpen && (
                  <div className="absolute bottom-full mb-1 left-0 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(emoji)}
                        className="text-base hover:scale-125 transition-transform px-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comments (reuses TaskComments with a notice-scoped key) */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <TaskComments
                taskId={`notice_${notice.id}`}
                taskTitle={notice.title}
                users={members}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoticeView() {
  const { confirm } = useModal();
  const { user, userProfile } = useAuth();
  const companyCode = userProfile?.companyCode || user?.uid || '';

  const [notices, setNotices] = useState<Notice[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notices'), where('companyCode', '==', companyCode));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Notice[];
        data.sort((a, b) => b.createdAt - a.createdAt);
        setNotices(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notices'),
    );
    return () => unsubscribe();
  }, [user, companyCode]);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;
    const newId = doc(collection(db, 'notices')).id;
    const authorName = userLabel(userProfile) || user.displayName || '작성자';
    try {
      await setDoc(doc(db, 'notices', newId), {
        userId: user.uid,
        authorName,
        companyCode,
        title: title.trim(),
        content: content.trim(),
        readBy: [user.uid],
        reactions: {},
        createdAt: Date.now(),
      });
      setIsAdding(false);
      setTitle('');
      setContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notices');
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: '확인',
      message: '공지사항을 삭제하시겠습니까?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'notices', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'notices');
        }
      },
    });
  };

  const unreadCount = notices.filter((n) => !(n.readBy || []).includes(user?.uid || '')).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand-500" /> 공지사항
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              안읽음 {unreadCount}
            </span>
          )}
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 공지 작성
        </button>
      </div>

      <div className="space-y-3">
        {notices.map((notice) => (
          <React.Fragment key={notice.id}>
            <NoticeCard
              notice={notice}
              members={members}
              currentUid={user?.uid || ''}
              onDelete={handleDelete}
            />
          </React.Fragment>
        ))}
        {notices.length === 0 && (
          <div className="text-center text-gray-500 py-12">등록된 공지사항이 없습니다.</div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">새 공지사항 작성</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="w-full border-gray-200 rounded-xl px-4 py-2 outline-none border focus:ring-brand-500 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600"
              >
                등록하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
