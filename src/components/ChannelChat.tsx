import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Send, Trash2, AtSign, SmilePlus, MessageSquare, CornerDownRight } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  authorName: string;
  text: string;
  createdAt: number;
  parentId?: string | null;
  mentions?: string[];
  reactions?: Record<string, string[]>;
}

const REACTIONS = ['👍', '❤️', '😄', '🎉', '👀', '✅'];

const userLabel = (u: any) =>
  u?.name || u?.displayName || u?.email || '이름 없음';

// Highlights @mentions inside message text.
function MessageBody({ content, users }: { content: string; users: any[] }) {
  const names = users.map((u) => userLabel(u));
  const escaped = names
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return <>{content}</>;
  const parts: React.ReactNode[] = [];
  const re = new RegExp(`@(${escaped.join('|')})`, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push(
      <span
        key={key++}
        className="text-brand-600 font-semibold bg-brand-50 rounded px-1"
      >
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return <>{parts}</>;
}

// Textarea with @mention autocomplete. Calls onSubmit(text, mentionedUsers).
function Composer({
  users,
  currentUid,
  placeholder,
  onSubmit,
  compact,
}: {
  users: any[];
  currentUid: string;
  placeholder: string;
  onSubmit: (text: string, mentioned: any[]) => Promise<void> | void;
  compact?: boolean;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const candidates =
    mentionQuery === null
      ? []
      : users
          .filter((u) => u.id !== currentUid)
          .filter((u) =>
            userLabel(u).toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);

  const updateMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/@([^\s@]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setHighlightIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (u: any) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/@([^\s@]*)$/, `@${userLabel(u)} `);
    setText(replaced + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(replaced.length, replaced.length);
      }
    });
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    const mentioned = users.filter(
      (u) => u.id !== currentUid && content.includes(`@${userLabel(u)}`),
    );
    try {
      await onSubmit(content, mentioned);
      setText('');
      setMentionQuery(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(candidates[highlightIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative">
      {mentionQuery !== null && candidates.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
          <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100 flex items-center gap-1">
            <AtSign className="w-3 h-3" /> 멤버 멘션
          </div>
          {candidates.map((u, idx) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                idx === highlightIdx
                  ? 'bg-brand-50 text-navy-900'
                  : 'hover:bg-gray-50 text-gray-700',
              )}
            >
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                {userLabel(u).charAt(0)}
              </span>
              <span className="truncate">{userLabel(u)}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          'flex items-end gap-2 border border-gray-200 rounded-xl bg-white focus-within:border-brand-300 transition-colors',
          compact ? 'p-1.5' : 'p-2',
        )}
      >
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={compact ? 1 : 2}
          className="flex-1 text-sm outline-none resize-none bg-transparent text-gray-700 placeholder:text-gray-400 px-1"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || submitting}
          className="shrink-0 p-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-lg transition"
          title="보내기 (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ReactionBar({
  message,
  currentUid,
  onToggle,
}: {
  message: ChatMessage;
  currentUid: string;
  onToggle: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const entries = Object.entries(message.reactions || {}).filter(
    ([, uids]) => uids.length > 0,
  );
  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {entries.map(([emoji, uids]) => {
        const mine = uids.includes(currentUid);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition',
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
          className="p-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition"
          title="반응 추가"
        >
          <SmilePlus className="w-3.5 h-3.5" />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full mb-1 left-0 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="text-base hover:scale-125 transition-transform px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Reusable channel/thread chat panel. Renders realtime messages for a single
 * chat (channel, DM, or project conversation), with @mentions, emoji
 * reactions, threaded replies, and read-state tracking.
 */
export default function ChannelChat({
  channelId,
  channelName,
  users,
}: {
  channelId: string;
  channelName: string;
  users: any[];
}) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channelId) return;
    const q = query(collection(db, 'messages'), where('chatId', '==', channelId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
        data.sort((a, b) => a.createdAt - b.createdAt);
        setMessages(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'messages'),
    );
    return () => unsub();
  }, [channelId]);

  // Reset transient UI state when switching channels.
  useEffect(() => {
    setOpenThread(null);
  }, [channelId]);

  const roots = messages.filter((m) => !m.parentId);
  const newest = roots.length ? roots[roots.length - 1].createdAt : 0;

  // Auto-scroll to latest root message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newest]);

  // Track read state: upsert lastReadAt whenever the channel or latest message changes.
  useEffect(() => {
    if (!user || !channelId) return;
    const readId = `${channelId}_${user.uid}`;
    setDoc(
      doc(db, 'channelReads', readId),
      { chatId: channelId, userId: user.uid, lastReadAt: Date.now() },
      { merge: true },
    ).catch(() => {
      /* read-state is best-effort; ignore failures */
    });
  }, [user, channelId, messages.length]);

  const authorName = userLabel(userProfile) || user?.displayName || '사용자';

  const sendMessage = async (
    text: string,
    mentioned: any[],
    parentId: string | null,
  ) => {
    if (!user) return;
    const now = Date.now();
    try {
      const msgId = doc(collection(db, 'messages')).id;
      await setDoc(doc(db, 'messages', msgId), {
        chatId: channelId,
        userId: user.uid,
        authorName,
        text,
        parentId: parentId,
        mentions: mentioned.map((u) => u.id),
        reactions: {},
        createdAt: now,
      });

      // Bump the channel's last-activity marker for unread indicators.
      updateDoc(doc(db, 'chats', channelId), {
        lastMessageAt: now,
        lastMessageText: text.slice(0, 60),
      }).catch(() => {
        /* channel doc may be a virtual project channel; ignore */
      });

      // Notify mentioned members.
      await Promise.all(
        mentioned.map((u) => {
          const notifId = doc(collection(db, 'notifications')).id;
          return setDoc(doc(db, 'notifications', notifId), {
            userId: u.id,
            type: 'channel',
            fromUserId: user.uid,
            fromName: authorName,
            taskId: '',
            taskTitle: channelName,
            content: text.slice(0, 200),
            read: false,
            createdAt: now,
          });
        }),
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!user) return;
    const current = message.reactions?.[emoji] || [];
    const has = current.includes(user.uid);
    const next = has
      ? current.filter((x) => x !== user.uid)
      : [...current, user.uid];
    const reactions = { ...(message.reactions || {}) };
    if (next.length) reactions[emoji] = next;
    else delete reactions[emoji];
    try {
      await updateDoc(doc(db, 'messages', message.id), { reactions });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'messages');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'messages');
    }
  };

  const repliesOf = (rootId: string) =>
    messages.filter((m) => m.parentId === rootId).sort((a, b) => a.createdAt - b.createdAt);

  const renderMessage = (m: ChatMessage, isReply = false) => (
    <div key={m.id} className={cn('flex gap-2.5 group', isReply && 'pl-2')}>
      <div
        className={cn(
          'shrink-0 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold',
          isReply ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs',
        )}
      >
        {(m.authorName || 'U').charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-navy-900">{m.authorName}</span>
          <span className="text-[10px] text-gray-400">{fmtTime(m.createdAt)}</span>
          {m.userId === user?.uid && (
            <button
              onClick={() => handleDelete(m.id)}
              className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">
          <MessageBody content={m.text} users={users} />
        </p>
        {!isReply && (
          <ReactionBar
            message={m}
            currentUid={user?.uid || ''}
            onToggle={(emoji) => toggleReaction(m, emoji)}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
        {roots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
            <MessageSquare className="w-10 h-10 mb-2 text-gray-200" />
            첫 메시지를 남겨보세요.
          </div>
        ) : (
          roots.map((m) => {
            const replies = repliesOf(m.id);
            const threadOpen = openThread === m.id;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-3">
                {renderMessage(m)}
                <div className="pl-10 mt-1">
                  <button
                    onClick={() => setOpenThread(threadOpen ? null : m.id)}
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium transition',
                      replies.length > 0
                        ? 'text-brand-600 hover:text-brand-700'
                        : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    {replies.length > 0 ? `답글 ${replies.length}개` : '답글 달기'}
                  </button>

                  {threadOpen && (
                    <div className="mt-2 space-y-3 border-l-2 border-gray-100 pl-3">
                      {replies.map((r) => renderMessage(r, true))}
                      <Composer
                        users={users}
                        currentUid={user?.uid || ''}
                        placeholder="답글을 입력하세요..."
                        compact
                        onSubmit={(text, mentioned) => sendMessage(text, mentioned, m.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Root composer */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <Composer
          users={users}
          currentUid={user?.uid || ''}
          placeholder={`#${channelName} 에 메시지 보내기 · @로 멘션, Enter로 전송`}
          onSubmit={(text, mentioned) => sendMessage(text, mentioned, null)}
        />
      </div>
    </div>
  );
}
