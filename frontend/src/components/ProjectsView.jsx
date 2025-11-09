import { useState } from "react";
import { ArrowRight, Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

export default function ProjectsView({
  projects,
  onRefresh,
  onCreate,
  onArchive,
  onRestore,
  onDelete,
  onToggleCompleted,
  onOpenProject,
}) {
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ ...form, status: "active" });
      setForm({ title: "", description: "", priority: "medium" });
    } catch (err) {
      console.error("Ошибка создания проекта", err);
    } finally {
      setSubmitting(false);
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
        {projects.map((project) => (
          <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400">{project.status}</p>
                <h2 className="text-lg font-semibold text-slate-800">{project.title}</h2>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">{project.description}</p>
                )}
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
        ))}
        {projects.length === 0 && (
          <div className="text-sm text-slate-500">Пока нет проектов — создайте первый выше.</div>
        )}
      </div>
    </div>
  );
}
