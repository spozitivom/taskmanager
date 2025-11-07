import React from "react";
import { Play, Check, RotateCcw, Trash2, Flag, Calendar, Pencil } from "lucide-react";
import * as api from "../api";

const STATUS_META = {
  todo: { label: "To Do", tone: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", tone: "bg-indigo-100 text-indigo-600" },
  done: { label: "Completed", tone: "bg-emerald-100 text-emerald-600" },
};

const PRIORITY_META = {
  low: { label: "Low", tone: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", tone: "bg-amber-100 text-amber-700" },
  high: { label: "High", tone: "bg-rose-100 text-rose-600" },
};

export default function TaskCard({ task, setTasks, onEditTask }) {
  const updateStatus = async (newStatus) => {
    try {
      const payload = { status: newStatus, stage: newStatus };
      const updated = await api.updateTask(task.id, payload);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      console.error("Ошибка обновления статуса:", err.message);
    }
  };

  const removeTask = async () => {
    try {
      await api.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      console.error("Ошибка удаления задачи:", err.message);
    }
  };

  const created = task.created_at
    ? new Date(task.created_at).toLocaleDateString()
    : "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {task.stage || "Без этапа"}
          </p>
          <h3 className="text-base font-semibold text-slate-800 leading-snug">
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditTask?.(task)}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={removeTask}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mt-2 text-sm text-slate-500 line-clamp-3">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={STATUS_META[task.status]?.tone}>
          {STATUS_META[task.status]?.label || "—"}
        </Badge>
        <Badge tone={PRIORITY_META[task.priority]?.tone} icon={<Flag className="h-3 w-3" />}>
          {PRIORITY_META[task.priority]?.label || "—"}
        </Badge>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-slate-400 ring-1 ring-slate-200">
          <Calendar className="h-3 w-3" />
          {created}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {task.status !== "in_progress" && (
          <ActionButton
            onClick={() => updateStatus("in_progress")}
            icon={<Play className="h-3.5 w-3.5" />}
            label="В работу"
            tone="border-amber-200 text-amber-600 bg-amber-50"
          />
        )}
        {task.status !== "done" && (
          <ActionButton
            onClick={() => updateStatus("done")}
            icon={<Check className="h-3.5 w-3.5" />}
            label="Завершить"
            tone="border-emerald-200 text-emerald-600 bg-emerald-50"
          />
        )}
        {task.status !== "todo" && (
          <ActionButton
            onClick={() => updateStatus("todo")}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="В ToDo"
            tone="border-indigo-200 text-indigo-600 bg-indigo-50"
          />
        )}
      </div>
    </div>
  );
}

function Badge({ tone = "bg-slate-100 text-slate-600", icon, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${tone}`}
    >
      {icon}
      {children}
    </span>
  );
}

function ActionButton({ onClick, icon, label, tone }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:brightness-105 transition ${tone}`}
    >
      {icon}
      {label}
    </button>
  );
}
