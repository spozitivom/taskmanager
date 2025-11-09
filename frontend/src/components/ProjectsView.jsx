import { useEffect, useState } from "react";
import {
  ArrowRight,
  Archive,
  RefreshCw,
  RotateCcw,
  Trash2,
  PencilLine,
  Loader2,
  X,
} from "lucide-react";
import { formatDeadline } from "../utils/formatters";

const PROJECT_STATUS_OPTIONS = [
  { label: "План", value: "planned" },
  { label: "Активен", value: "active" },
  { label: "Заморожен", value: "frozen" },
  { label: "Завершён", value: "completed" },
];

export default function ProjectsView({
  projects,
  onRefresh,
  onCreate,
  onArchive,
  onRestore,
  onDelete,
  onToggleCompleted,
  onOpenProject,
  onUpdate,
}) {
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", deadline: "" });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingSubmitting, setEditingSubmitting] = useState(false);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: "active",
        deadline: toISODate(form.deadline),
      });
      setForm({ title: "", description: "", priority: "medium", deadline: "" });
    } catch (err) {
      console.error("Ошибка создания проекта", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!editing) return;
    setEditingSubmitting(true);
    try {
      await onUpdate(editing.id, payload);
      setEditing(null);
    } catch (err) {
      console.error("Не удалось обновить проект", err);
    } finally {
      setEditingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Проекты</h1>
          <p className="text-sm text-slate-500">Управляйте инициативами и следите за прогрессом.</p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100"
        >
          <RefreshCw className="h-4 w-4" /> Обновить
        </button>
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            placeholder="Название проекта"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </div>
        <textarea
          placeholder="Краткое описание"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <button
          type="submit"
          disabled={submitting || !form.title.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <ArrowRight className="h-4 w-4" /> Создать проект
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const deadlineMeta = formatDeadline(project.deadline);
          return (
          <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400">{project.status}</p>
                <h2 className="text-lg font-semibold text-slate-800">{project.title}</h2>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">{project.description}</p>
                )}
                <p className={`text-xs mt-2 ${deadlineMeta.tone}`}>
                  Дедлайн: {deadlineMeta.text}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {project.tasks_count} задач
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                onClick={() => onOpenProject(project.id)}
                className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
              >
                Открыть
              </button>
              <button
                onClick={() => setEditing(project)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600"
              >
                <PencilLine className="h-3 w-3" /> Изменить
              </button>
              {project.archived_at ? (
                <button
                  onClick={() => onRestore(project.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1 text-emerald-600"
                >
                  <RotateCcw className="h-3 w-3" /> Восстановить
                </button>
              ) : (
                <button
                  onClick={() => onArchive(project.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                >
                  <Archive className="h-3 w-3" /> Архивировать
                </button>
              )}
              <button
                onClick={() => onToggleCompleted(project.id, "cancel_unfinished")}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 px-3 py-1 text-indigo-600"
              >
                Завершить
              </button>
              <button
                onClick={() => onDelete(project.id)}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-rose-600"
              >
                <Trash2 className="h-3 w-3" /> Удалить
              </button>
            </div>
          </article>
        );})}
        {projects.length === 0 && (
          <div className="text-sm text-slate-500">Пока нет проектов — создайте первый выше.</div>
        )}
      </div>

      {editing && (
        <ProjectEditorModal
          project={editing}
          submitting={editingSubmitting}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  );
}

function ProjectEditorModal({ project, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(getInitialProjectState(project));

  useEffect(() => {
    setForm(getInitialProjectState(project));
  }, [project]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      deadline: toISODate(form.deadline),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-800">Редактировать проект</h3>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <Field label="Название">
            <input
              value={form.title}
              onChange={handleChange("title")}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </Field>
          <Field label="Описание">
            <textarea
              value={form.description}
              onChange={handleChange("description")}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Статус">
              <select
                value={form.status}
                onChange={handleChange("status")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {PROJECT_STATUS_OPTIONS.map((option) => (
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Дедлайн">
              <input
                type="date"
                value={form.deadline}
                onChange={handleChange("deadline")}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </button>
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

function getInitialProjectState(project) {
  if (!project) {
    return {
      title: "",
      description: "",
      status: "active",
      priority: "medium",
      deadline: "",
    };
  }
  return {
    title: project.title || "",
    description: project.description || "",
    status: project.status || "active",
    priority: project.priority || "medium",
    deadline: project.deadline ? project.deadline.slice(0, 10) : "",
  };
}

function toISODate(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`).toISOString();
}
