import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Send, Trash2, AtSign } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";

interface Comment {
  id: string;
  taskId: string;
  userId: string;
  authorName: string;
  content: string;
  mentions: string[];
  createdAt: number;
}

const userLabel = (u: any) =>
  u?.name || u?.displayName || u?.email || "이름 없음";

// Renders comment text, highlighting @mentions.
function CommentBody({
  content,
  users,
}: {
  content: string;
  users: any[];
}) {
  const names = users.map((u) => userLabel(u));
  // Build a regex that matches @name for any known user name.
  const escaped = names
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts: React.ReactNode[] = [];
  if (escaped.length === 0) return <>{content}</>;
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
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

export default function TaskComments({
  taskId,
  taskTitle,
  users,
}: {
  taskId: string;
  taskTitle: string;
  users: any[];
}) {
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!taskId) return;
    const q = query(
      collection(db, "comments"),
      where("taskId", "==", taskId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Comment[];
        data.sort((a, b) => a.createdAt - b.createdAt);
        setComments(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "comments"),
    );
    return () => unsub();
  }, [taskId]);

  const candidates =
    mentionQuery === null
      ? []
      : users
          .filter((u) => u.id !== user?.uid)
          .filter((u) =>
            userLabel(u)
              .toLowerCase()
              .includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);

  const updateMentionState = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/@([^\s@]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setHighlightIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
  };

  const insertMention = (u: any) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/@([^\s@]*)$/, `@${userLabel(u)} `);
    const next = replaced + after;
    setText(next);
    setMentionQuery(null);
    // Restore focus and caret after the inserted mention.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = replaced.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && candidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(
          (i) => (i - 1 + candidates.length) % candidates.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(candidates[highlightIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    // Submit with Cmd/Ctrl+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const content = text.trim();
    if (!user || !content || submitting) return;
    setSubmitting(true);

    // Resolve mentioned users by matching "@name" tokens in the text.
    const mentioned = users.filter(
      (u) =>
        u.id !== user.uid &&
        content.includes(`@${userLabel(u)}`),
    );
    const authorName = userLabel(userProfile) || user.displayName || "사용자";

    try {
      const commentId = doc(collection(db, "comments")).id;
      await setDoc(doc(db, "comments", commentId), {
        taskId,
        userId: user.uid,
        authorName,
        content,
        mentions: mentioned.map((u) => u.id),
        createdAt: Date.now(),
      });

      // Notify each mentioned employee.
      await Promise.all(
        mentioned.map((u) => {
          const notifId = doc(collection(db, "notifications")).id;
          return setDoc(doc(db, "notifications", notifId), {
            userId: u.id,
            type: "mention",
            fromUserId: user.uid,
            fromName: authorName,
            taskId,
            taskTitle: taskTitle || "",
            content: content.slice(0, 200),
            read: false,
            createdAt: Date.now(),
          });
        }),
      );

      setText("");
      setMentionQuery(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "comments");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "comments", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "comments");
    }
  };

  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d
      .getHours()
      .toString()
      .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
        <MessageBadge count={comments.length} />
      </label>

      {/* Comment list */}
      <div className="space-y-3 mb-3">
        {comments.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">
            첫 댓글을 남겨보세요.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 group">
              <div className="w-7 h-7 shrink-0 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                {(c.authorName || "U").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-900">
                    {c.authorName}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {fmtTime(c.createdAt)}
                  </span>
                  {c.userId === user?.uid && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      title="댓글 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">
                  <CommentBody content={c.content} users={users} />
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input with @mention autocomplete */}
      <div className="relative">
        {mentionQuery !== null && candidates.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
            <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100 flex items-center gap-1">
              <AtSign className="w-3 h-3" /> 임직원 멘션
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
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                  idx === highlightIdx
                    ? "bg-brand-50 text-navy-900"
                    : "hover:bg-gray-50 text-gray-700",
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
        <div className="flex items-end gap-2 border border-gray-200 rounded-lg p-2 focus-within:border-brand-300 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="댓글을 입력하세요. @로 임직원을 멘션할 수 있습니다."
            rows={2}
            className="flex-1 text-sm outline-none resize-none bg-transparent text-gray-700 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="shrink-0 p-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-lg transition"
            title="댓글 등록 (Cmd/Ctrl+Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBadge({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1.5">
      댓글
      <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </span>
  );
}
