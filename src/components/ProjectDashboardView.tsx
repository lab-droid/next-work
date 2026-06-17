import React, { useState } from "react";
import DocumentsView from "./DocumentsView";
import KanbanBoard from "./KanbanBoard";
import CalendarView from "./CalendarView";
import AnalyticsView from "./AnalyticsView";
import {
  ArrowLeft,
  MessageSquare,
  KanbanSquare,
  FolderOpen,
  Bell,
  LineChart,
  GanttChartSquare,
  CheckSquare,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  companyCode: string;
  createdAt: number;
}

export default function ProjectDashboardView({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState("tasks");

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
      <div className="p-4 sm:px-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-4 border-r border-gray-200 pr-6 mr-2 shrink-0">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-navy-900 truncate max-w-[150px] sm:max-w-xs">
            {project.name}
          </h2>
        </div>
        <div className="flex gap-2 flex-1 overflow-x-auto no-scrollbar pb-2 sm:pb-0 items-center justify-start">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "tasks" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <KanbanSquare className="w-4 h-4" /> <span>업무</span>
          </button>
          <button
            onClick={() => setActiveTab("my-tasks")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "my-tasks" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <CheckSquare className="w-4 h-4" /> <span>내 업무</span>
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "feed" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <MessageSquare className="w-4 h-4" /> <span>피드</span>
          </button>
          <button
            onClick={() => setActiveTab("gantt")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "gantt" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <GanttChartSquare className="w-4 h-4" /> <span>간트차트</span>
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "files" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <FolderOpen className="w-4 h-4" /> <span>파일</span>
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "notifications" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <Bell className="w-4 h-4" /> <span>알림</span>
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === "insights" ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200/50 bg-white border border-gray-200"}`}
          >
            <LineChart className="w-4 h-4" /> <span>인사이트</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50/30">
        {activeTab === "feed" && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <MessageSquare className="w-12 h-12 text-gray-300" />
            <p className="font-medium">프로젝트 피드 기능이 준비 중입니다.</p>
          </div>
        )}
        {activeTab === "tasks" && (
          <KanbanBoard projectId={project.id} embedded />
        )}
        {activeTab === "my-tasks" && (
          <KanbanBoard projectId={project.id} embedded mode="my" />
        )}
        {activeTab === "gantt" && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <GanttChartSquare className="w-12 h-12 text-gray-300" />
            <p className="font-medium">간트차트 컴포넌트를 구성 중입니다.</p>
          </div>
        )}
        {activeTab === "files" && (
          <DocumentsView projectId={project.id} embedded />
        )}
        {activeTab === "notifications" && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <Bell className="w-12 h-12 text-gray-300" />
            <p className="font-medium">알림 내역이 없습니다.</p>
          </div>
        )}
        {activeTab === "insights" && (
          <div className="p-4 h-full">
            <AnalyticsView />
          </div>
        )}
      </div>
    </div>
  );
}
