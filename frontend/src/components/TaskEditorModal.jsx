import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "In Review", value: "in_review" },
  { label: "Completed", value: "completed" },
];

const PRIORITY_OPTIONS = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

export default function TaskEditorModal({ task, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(getInitialState(task));

  useEffect(() => {
    setForm(getInitialState(task));
  }, [task]);

  if (!task) return null;

  const handleChange = (field) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    onSubmit?.(form);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Редактирование</p>
            <h2 className="text-lg font-semibold text-slate-800">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название">
              <input
                value={form.title}
                onChange={handleChange("title")}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
            <Field label="Этап">
              <input
                value={form.stage}
                onChange={handleChange("stage")}
                placeholder="Например: Backend"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Описание">
            <textarea
              value={form.description}
              onChange={handleChange("description")}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Статус">
              <select
                value={form.status}
                onChange={handleChange("status")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Приоритет">
              <select
                value={form.priority}
                onChange={handleChange("priority")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <span className="text-xs text-slate-400">
              Создано:{" "}
              {task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function getInitialState(task) {
  if (!task) {
    return {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      stage: "",
    };
  }

  return {
    title: task.title || "",
    description: task.description || "",
    status: task.status || "todo",
    priority: task.priority || "medium",
    stage: task.stage || "",
  };
}
