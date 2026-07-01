import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

const DraggableComponent = Draggable as any;
const DroppableComponent = Droppable as any;
import {
  Plus,
  MoreHorizontal,
  Clock,
  MessageSquare,
  Paperclip,
  X,
  Trash2,
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { useModal } from "../lib/ModalContext";
import { useTaskCategories, CategoryData } from "../hooks/useTaskCategories";
import { Settings as SettingsIcon } from "lucide-react";
import TaskComments from "./TaskComments";

interface Task {
  id: string;
  userId: string;
  projectId?: string;
  assigneeId?: string;
  title: string;
  content: string;
  tag: string;
  tagColor: string;
  status: string; // 'todo', 'inProgress', 'feedback', 'done', 'hold'
  category?: string;
  createdAt: number;
  startDate?: number;
  endDate?: number;
}

export default function KanbanBoard({
  projectId,
  embedded,
  mode = "project",
  onSelectProject,
}: {
  projectId?: string;
  embedded?: boolean;
  mode?: "project" | "all" | "my";
  onSelectProject?: (p: any) => void;
}) {
  const { confirm, alert } = useModal();
  const { user } = useAuth();
  const { categories, saveCategories, loading } = useTaskCategories();
  const COLUMNS = categories.map((c) => ({
    id: c.main,
    title: c.main,
    subs: c.subs,
  }));
  const [fetchedTasks, setFetchedTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "feed">("list");
  const [isAdding, setIsAdding] = useState<string | null>(null); // column id

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempCategories, setTempCategories] = useState<CategoryData[]>([]);

  // Edit Task Modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // New task form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(
    projectId || "",
  );
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    setNewTaskProjectId(projectId || "");
  }, [projectId]);

  useEffect(() => {
    if (categories.length > 0 && !newTaskStatus) {
      setNewTaskStatus(categories[0].subs[0] || categories[0].main);
    }
  }, [categories]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        const u = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsers(u);
      },
      (error: any) => {
        if (error.code !== "permission-denied") {
          console.error("KanbanBoard users query error:", error);
        }
      },
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (docInfo) => {
      if (docInfo.exists()) {
        const data = docInfo.data();
        const code = data.companyCode || data.companyId || null;
        if (code === undefined) return;
        const pq = query(
          collection(db, "projects"),
          where("companyCode", "==", code),
        );
        const unsubProjects = onSnapshot(
          pq,
          (snap) => {
            setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => console.log("projects load err", err),
        );
        return () => unsubProjects();
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let unsubTasks: any = null;
    let unsubUser = onSnapshot(doc(db, "users", user.uid), (docInfo) => {
      if (docInfo.exists()) {
        let q = query(collection(db, "tasks"));
        if (unsubTasks) unsubTasks(); // unsubscribe previous if exists
        unsubTasks = onSnapshot(
          q,
          (snapshot) => {
            let data = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as Task[];
            setFetchedTasks(data);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, "tasks"),
        );
      }
    });

    return () => {
      unsubUser();
      if (unsubTasks) unsubTasks();
    };
  }, [user]);

  const tasks = React.useMemo(() => {
    let data = [...fetchedTasks];
    if (mode === "project") {
      if (projectId) {
        data = data.filter((d) => (d as any).projectId === projectId);
      } else {
        data = data.filter((d) => !(d as any).projectId);
      }
    } else if (mode === "my") {
      data = data.filter((d) => d.assigneeId === user?.uid);
      const projectIds = projects.map((p) => p.id);
      data = data.filter(
        (d) => d.projectId && projectIds.includes(d.projectId),
      );
    } else if (mode === "all") {
      const projectIds = projects.map((p) => p.id);
      data = data.filter(
        (d) => d.projectId && projectIds.includes(d.projectId),
      );
    }
    return data.sort((a, b) => b.createdAt - a.createdAt);
  }, [fetchedTasks, projectId, mode, projects, user]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    // We only update status.
    try {
      const col = COLUMNS.find((c) => c.id === destination.droppableId);
      const newStatus = col ? col.subs[0] : destination.droppableId;
      await updateDoc(doc(db, "tasks", draggableId), {
        status: newStatus,
        category: newStatus,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "tasks");
    }
  };

  const handleAddTask = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim() || !tag.trim()) return;
    const newId = doc(collection(db, "tasks")).id;
    try {
      const col = COLUMNS.find((c) => c.id === status);
      const actualStatus = col ? col.subs[0] : status;

      await setDoc(doc(db, "tasks", newId), {
        userId: user.uid,
        projectId: newTaskProjectId || projectId || null,
        assigneeId: assigneeId || user.uid,
        title: title.trim(),
        content: content.trim(),
        tag: tag.trim(),
        tagColor: "text-blue-600 bg-blue-50 border-blue-100", // default style
        status: actualStatus,
        category: actualStatus,
        createdAt: Date.now(),
      });
      setIsAdding(null);
      setTitle("");
      setContent("");
      setTag("");
      setAssigneeId("");
      setNewTaskProjectId(projectId || "");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "tasks");
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: "확인",
      message: "작업을 삭제하시겠습니까?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "tasks", id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, "tasks");
        }
      },
    });
  };

  return (
    <div className={`h-full flex flex-col ${embedded ? "" : "pt-2"} pb-6`}>
      <div className="flex justify-between items-center mb-6 px-1 flex-wrap gap-4">
        {!embedded ? (
          <div>
            <h2 className="text-2xl font-bold text-navy-900">
              {mode === "all"
                ? "전체 업무"
                : mode === "my"
                  ? "내 업무"
                  : "프로젝트 보드"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === "all"
                ? "회사 내 개설된 모든 프로젝트의 업무 현황을 한눈에 파악하고 관리하세요."
                : mode === "my"
                  ? "배정된 모든 업무의 현황을 파악하고 관리하세요."
                  : "프로젝트에 등록된 업무를 보드와 리스트 형태로 관리하세요."}
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "list"
                ? "bg-white text-navy-900 shadow-sm"
                : "text-gray-500 hover:text-navy-900",
            )}
          >
            리스트형
          </button>
          <button
            onClick={() => setViewMode("feed")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "feed"
                ? "bg-white text-navy-900 shadow-sm"
                : "text-gray-500 hover:text-navy-900",
            )}
          >
            피드형
          </button>
          <div className="w-px bg-gray-200 mx-1 my-1"></div>
          <button
            onClick={() => {
              setTempCategories(JSON.parse(JSON.stringify(categories)));
              setIsSettingsOpen(true);
            }}
            className="px-2 py-1.5 rounded-md text-gray-500 hover:text-navy-900 transition-colors"
            title="상태 카테고리 관리"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === "feed" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-4 h-full items-start kanban-scroll">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) =>
                col.subs.includes((t.category || t.status) as string),
              );
              return (
                <div
                  key={col.id}
                  className="w-80 flex-shrink-0 flex flex-col bg-gray-50/50 rounded-2xl h-full border border-gray-100"
                >
                  <div className="p-4 flex justify-between items-center bg-white/50 border-b border-gray-100 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-navy-900">{col.title}</h3>
                      <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {colTasks.length}
                      </span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  <DroppableComponent droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 p-3 overflow-y-auto min-h-[150px] transition-colors rounded-b-2xl",
                          snapshot.isDraggingOver ? "bg-brand-50/50" : "",
                        )}
                      >
                        <div className="space-y-3">
                          {colTasks.map((task, index) => (
                            <DraggableComponent
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-white p-4 rounded-xl shadow-sm border transition-shadow cursor-pointer",
                                    snapshot.isDragging
                                      ? "shadow-md border-brand-200 rotate-2"
                                      : "border-gray-200 hover:border-gray-300",
                                  )}
                                  style={{ ...provided.draggableProps.style }}
                                  onClick={() => setEditingTask(task)}
                                >
                                  <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold px-2 py-1 rounded-md border tracking-wide uppercase",
                                          task.tagColor,
                                        )}
                                      >
                                        {task.tag}
                                      </span>
                                      {task.projectId &&
                                        (mode === "all" || mode === "my") &&
                                        (onSelectProject ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const p = projects.find(
                                                (proj) =>
                                                  proj.id === task.projectId,
                                              );
                                              if (p) onSelectProject(p);
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-md border text-brand-600 bg-brand-50 border-brand-100 hover:bg-brand-100 transition-colors max-w-[120px] truncate cursor-pointer"
                                            title="프로젝트로 이동"
                                          >
                                            {projects.find(
                                              (proj) =>
                                                proj.id === task.projectId,
                                            )?.name || "연결됨"}
                                          </button>
                                        ) : (
                                          <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-md border text-brand-600 bg-brand-50 border-brand-100 max-w-[120px] truncate">
                                            {projects.find(
                                              (proj) =>
                                                proj.id === task.projectId,
                                            )?.name || "연결됨"}
                                          </span>
                                        ))}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(task.id);
                                      }}
                                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <h4 className="font-bold text-navy-900 mb-1">
                                    {task.title || "-"}
                                  </h4>
                                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                    {task.content}
                                  </p>
                                  {(task.startDate || task.endDate) && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium mb-3">
                                      <Clock className="w-3 h-3" />
                                      <span>
                                        {task.startDate
                                          ? new Date(task.startDate)
                                              .toLocaleDateString()
                                              .slice(5, -1)
                                          : ""}
                                        {task.startDate && task.endDate
                                          ? " - "
                                          : ""}
                                        {task.endDate
                                          ? new Date(task.endDate)
                                              .toLocaleDateString()
                                              .slice(5, -1)
                                          : ""}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center text-gray-500">
                                    <div className="flex -space-x-1">
                                      {task.assigneeId &&
                                        users.find(
                                          (u) => u.id === task.assigneeId,
                                        ) && (
                                          <div
                                            className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs border border-white font-bold"
                                            title={
                                              users.find(
                                                (u) => u.id === task.assigneeId,
                                              )?.name ||
                                              users.find(
                                                (u) => u.id === task.assigneeId,
                                              )?.displayName ||
                                              "담당자"
                                            }
                                          >
                                            {(
                                              users.find(
                                                (u) => u.id === task.assigneeId,
                                              )?.name ||
                                              users.find(
                                                (u) => u.id === task.assigneeId,
                                              )?.displayName ||
                                              "U"
                                            ).charAt(0)}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DraggableComponent>
                          ))}
                          {provided.placeholder}
                        </div>

                        {isAdding === col.id ? (
                          <form
                            onSubmit={(e) => handleAddTask(e, newTaskStatus)}
                            className="mt-4 bg-white p-3 rounded-xl border border-brand-200"
                          >
                            <input
                              type="text"
                              autoFocus
                              required
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="제목"
                              className="w-full text-sm font-bold outline-none mb-2"
                            />
                            <textarea
                              required
                              value={content}
                              onChange={(e) => setContent(e.target.value)}
                              placeholder="작업 내용"
                              className="w-full text-xs text-gray-600 outline-none mb-2 resize-none h-16"
                            />
                            <select
                              value={newTaskStatus}
                              onChange={(e) => setNewTaskStatus(e.target.value)}
                              className="w-full text-sm outline-none mb-2 bg-gray-50 rounded px-2 py-1 text-gray-600 text-xs"
                            >
                              {col.subs.map((s) => (
                                <option key={s} value={s}>
                                  [{col.title}] {s}
                                </option>
                              ))}
                            </select>
                            {(mode === "all" || mode === "my") && (
                              <select
                                value={newTaskProjectId}
                                onChange={(e) =>
                                  setNewTaskProjectId(e.target.value)
                                }
                                className="w-full text-sm outline-none mb-2 bg-gray-50 rounded px-2 py-1 text-gray-600 text-xs font-medium"
                                required
                              >
                                <option value="">프로젝트 선택</option>
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              required
                              value={tag}
                              onChange={(e) => setTag(e.target.value)}
                              placeholder="태그 (예: 기획)"
                              className="w-full text-sm outline-none mb-2"
                            />
                            <select
                              value={assigneeId}
                              onChange={(e) => setAssigneeId(e.target.value)}
                              className="w-full text-sm outline-none mb-3 bg-gray-50 rounded px-2 py-1 text-gray-600"
                            >
                              <option value="">담당자 선택 (기본: 본인)</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name || u.displayName || "이름 없음"}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAdding(null);
                                  setTitle("");
                                  setContent("");
                                  setTag("");
                                  setAssigneeId("");
                                }}
                                className="px-2 py-1 text-gray-500 text-xs hover:text-navy-900 bg-gray-100 rounded"
                              >
                                취소
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs"
                              >
                                저장
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            onClick={() => {
                              setIsAdding(col.id);
                              setNewTaskStatus(col.subs[0]);
                              setTitle("");
                              setContent("");
                              setTag("");
                              setAssigneeId("");
                            }}
                            className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-navy-900 hover:border-gray-400 hover:bg-gray-100/50 transition-all text-sm font-semibold flex items-center justify-center gap-2 group"
                          >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span>작업 추가</span>
                          </button>
                        )}
                      </div>
                    )}
                  </DroppableComponent>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto w-full kanban-scroll pr-2 h-full">
          <div className="bg-white rounded-2xl border border-brand-200 p-4 mb-2 shrink-0">
            <h4 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-500" />새 작업 추가
            </h4>
            <form
              onSubmit={(e) => handleAddTask(e, newTaskStatus)}
              className="flex flex-col lg:flex-row gap-3 items-end"
            >
              {(mode === "all" || mode === "my") && (
                <div className="w-full lg:w-48 shrink-0">
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">
                    프로젝트
                  </label>
                  <select
                    value={newTaskProjectId}
                    onChange={(e) => setNewTaskProjectId(e.target.value)}
                    className="w-full text-xs outline-none border border-gray-200 bg-gray-50 rounded-lg px-2 py-2 text-navy-900 font-medium"
                    required
                  >
                    <option value="">프로젝트 선택</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full lg:w-48 shrink-0">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  상태
                </label>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                  className="w-full text-xs outline-none border border-gray-200 bg-gray-50 rounded-lg px-2 py-2 text-navy-900"
                >
                  {categories.flatMap((c) =>
                    c.subs.map((s) => (
                      <option key={s} value={s}>
                        [{c.main}] {s}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="w-full lg:w-28 shrink-0">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  태그
                </label>
                <input
                  type="text"
                  required
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="예: 기획"
                  className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-1.5"
                />
              </div>
              <div className="w-full lg:flex-1">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="작업명"
                  className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-1.5"
                />
              </div>
              <div className="w-full lg:flex-1">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  내용
                </label>
                <input
                  type="text"
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="내용"
                  className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-1.5"
                />
              </div>
              <div className="w-full lg:w-32 shrink-0">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  담당자
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-sm outline-none border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-gray-600"
                >
                  <option value="">본인</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.displayName || "이름 없음"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full lg:w-20 shrink-0 flex pb-[1px]">
                <button
                  type="submit"
                  className="w-full py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
                >
                  추가
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm whitespace-nowrap min-w-[200px]">
                    상태
                  </th>
                  {(mode === "all" || mode === "my") && (
                    <th className="py-3 px-4 font-semibold text-gray-500 text-sm">
                      프로젝트
                    </th>
                  )}
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm">
                    작업명
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-48">
                    내용
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-32">
                    담당자
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-24">
                    생성일
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-24">
                    시작일
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-24">
                    마감일
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-500 text-sm w-16 text-center">
                    동작
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={mode === "all" || mode === "my" ? 9 : 8}
                      className="py-8 text-center text-gray-400"
                    >
                      등록된 작업이 없습니다
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-gray-50 transition-colors group cursor-pointer"
                      onClick={() => setEditingTask(task)}
                    >
                      <td className="py-3 px-4">
                        <select
                          value={(task.category || task.status) as string}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateDoc(doc(db, "tasks", task.id), {
                                category: e.target.value,
                                status: e.target.value,
                              });
                            } catch (err) {
                              handleFirestoreError(
                                err,
                                OperationType.UPDATE,
                                "tasks",
                              );
                            }
                          }}
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none text-gray-700 bg-white group-hover:bg-gray-50 focus:bg-white transition-colors"
                        >
                          {categories.flatMap((c) =>
                            c.subs.map((s) => (
                              <option key={s} value={s}>
                                [{c.main}] {s}
                              </option>
                            )),
                          )}
                        </select>
                      </td>
                      {(mode === "all" || mode === "my") && (
                        <td
                          className="py-3 px-4"
                          onClick={(e) => {
                            if (task.projectId && onSelectProject) {
                              e.stopPropagation();
                              const p = projects.find(
                                (proj) => proj.id === task.projectId,
                              );
                              if (p) onSelectProject(p);
                            }
                          }}
                        >
                          {task.projectId ? (
                            onSelectProject ? (
                              <button className="px-2 py-0.5 text-xs font-bold tracking-wide uppercase rounded-md border text-brand-600 bg-brand-50 border-brand-100 hover:bg-brand-100 transition-colors max-w-[150px] truncate text-left cursor-pointer">
                                {projects.find(
                                  (proj) => proj.id === task.projectId,
                                )?.name || "연결됨"}
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-bold tracking-wide uppercase rounded-md border text-brand-600 bg-brand-50 border-brand-100 max-w-[150px] truncate">
                                {projects.find(
                                  (proj) => proj.id === task.projectId,
                                )?.name || "연결됨"}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-900 text-sm truncate max-w-xs">
                          {task.title}
                        </div>
                        <div
                          className={cn(
                            "inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase",
                            task.tagColor,
                          )}
                        >
                          {task.tag}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {task.content}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {task.assigneeId &&
                        users.find((u) => u.id === task.assigneeId) ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                              {(
                                users.find((u) => u.id === task.assigneeId)
                                  ?.name ||
                                users.find((u) => u.id === task.assigneeId)
                                  ?.displayName ||
                                "U"
                              ).charAt(0)}
                            </div>
                            <span className="text-gray-600 truncate max-w-[100px]">
                              {users.find((u) => u.id === task.assigneeId)
                                ?.name || "담당자"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {task.startDate
                          ? new Date(task.startDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {task.endDate
                          ? new Date(task.endDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task.id);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-navy-900">
                상태 카테고리 설정
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {tempCategories.map((c, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <input
                      type="text"
                      value={c.main}
                      onChange={(e) => {
                        const newCat = [...tempCategories];
                        newCat[idx].main = e.target.value;
                        setTempCategories(newCat);
                      }}
                      className="font-bold text-navy-900 bg-white border border-gray-200 px-2 py-1 rounded outline-none text-sm w-32"
                    />
                    <button
                      onClick={() =>
                        setTempCategories(
                          tempCategories.filter((_, i) => i !== idx),
                        )
                      }
                      className="text-red-500 hover:text-red-600 text-xs font-medium"
                    >
                      상위 항목 삭제
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {c.subs.map((s, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-1 bg-white border border-gray-200 pl-2 pr-1 py-1 rounded text-xs text-gray-600"
                      >
                        <input
                          type="text"
                          value={s}
                          onChange={(e) => {
                            const newCat = [...tempCategories];
                            newCat[idx].subs[sIdx] = e.target.value;
                            setTempCategories(newCat);
                          }}
                          className="outline-none w-20 bg-transparent min-w-[60px]"
                        />
                        <button
                          onClick={() => {
                            const newCat = [...tempCategories];
                            newCat[idx].subs = newCat[idx].subs.filter(
                              (_, i) => i !== sIdx,
                            );
                            setTempCategories(newCat);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newCat = [...tempCategories];
                        newCat[idx].subs.push("새 하위상태");
                        setTempCategories(newCat);
                      }}
                      className="bg-white border border-dashed border-gray-300 text-gray-400 hover:text-brand-500 text-xs px-2 py-1.5 rounded flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 추가
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setTempCategories([
                    ...tempCategories,
                    { main: "새 상위상태", subs: ["새 하위상태"] },
                  ])
                }
                className="w-full py-3 rounded-xl border border-dashed border-brand-300 text-brand-600 font-medium text-sm hover:bg-brand-50 transition-colors"
              >
                + 새 상위 카테고리 추가
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => {
                  saveCategories(tempCategories);
                  setIsSettingsOpen(false);
                }}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-navy-900">업무 수정</h3>
              <button
                onClick={() => setEditingTask(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, title: e.target.value })
                  }
                  className="w-full text-base font-bold outline-none border border-gray-200 rounded-lg px-3 py-2 text-navy-900"
                />
              </div>
              {(mode === "all" || mode === "my") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 font-semibold text-gray-400">
                    프로젝트
                  </label>
                  <select
                    value={editingTask.projectId || ""}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        projectId: e.target.value || undefined,
                      })
                    }
                    className="w-full text-sm outline-none border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-600 font-bold"
                  >
                    <option value="">프로젝트 선택</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  내용
                </label>
                <textarea
                  value={editingTask.content}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, content: e.target.value })
                  }
                  className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 text-gray-600 h-24 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    상태
                  </label>
                  <select
                    value={
                      (editingTask.category || editingTask.status) as string
                    }
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        category: e.target.value,
                        status: e.target.value,
                      })
                    }
                    className="w-full text-sm outline-none border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-700 font-bold"
                  >
                    {categories.flatMap((c) =>
                      c.subs.map((s) => (
                        <option key={s} value={s}>
                          [{c.main}] {s}
                        </option>
                      )),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    담당자
                  </label>
                  <select
                    value={editingTask.assigneeId || ""}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        assigneeId: e.target.value,
                      })
                    }
                    className="w-full text-sm outline-none border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-600"
                  >
                    <option value="">담당자 없음</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.displayName || "이름 없음"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={
                      editingTask.startDate
                        ? new Date(editingTask.startDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        startDate: e.target.value
                          ? new Date(e.target.value).getTime()
                          : undefined,
                      })
                    }
                    className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    마감일
                  </label>
                  <input
                    type="date"
                    value={
                      editingTask.endDate
                        ? new Date(editingTask.endDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        endDate: e.target.value
                          ? new Date(e.target.value).getTime()
                          : undefined,
                      })
                    }
                    className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 text-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  태그
                </label>
                <input
                  type="text"
                  value={editingTask.tag}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, tag: e.target.value })
                  }
                  className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 text-gray-600"
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <TaskComments
                  taskId={editingTask.id}
                  taskTitle={editingTask.title}
                  users={users}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setEditingTask(null)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "tasks", editingTask.id), {
                      title: editingTask.title,
                      content: editingTask.content,
                      tag: editingTask.tag,
                      status: editingTask.status,
                      category: editingTask.category,
                      projectId: editingTask.projectId || null,
                      assigneeId: editingTask.assigneeId || null,
                      startDate: editingTask.startDate || null,
                      endDate: editingTask.endDate || null,
                    });
                    setEditingTask(null);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, "tasks");
                  }
                }}
                className="px-5 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
