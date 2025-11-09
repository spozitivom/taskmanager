import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import TaskDashboard from "./components/TaskDashboard";
import ProjectsView from "./components/ProjectsView";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState("desc");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [stage, setStage] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState("tasks");

  const [identifier, setIdentifier] = useState("dima");
  const [password, setPassword] = useState("123456");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getTasks()
      .then(() => setIsLoggedIn(true))
      .catch(() => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchProjects = useCallback(() => {
    api
      .getProjects(false)
      .then(setProjects)
      .catch((err) => console.error("Ошибка загрузки проектов:", err.message));
  }, []);

  const fetchTasks = useCallback(() => {
    const params = new URLSearchParams();
    if (sort) params.append("sort", sort);
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);
    if (stage) params.append("stage", stage);
    if (projectFilter === "none") {
      params.append("project_id", 0);
    } else if (projectFilter) {
      params.append("project_id", projectFilter);
    }

    api
      .getTasks(params.toString())
      .then(setTasks)
      .catch((err) => console.error("Ошибка загрузки задач:", err.message));
  }, [sort, status, priority, stage, projectFilter]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchTasks();
      fetchProjects();
    }
  }, [isLoggedIn, fetchTasks, fetchProjects]);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      alert("Введите email/username и пароль");
      return;
    }
    try {
      await api.login(identifier, password);
      setIsLoggedIn(true);
      fetchTasks();
      fetchProjects();
    } catch (err) {
      console.error("Ошибка логина:", err.message);
      alert("Неверный логин или пароль");
    }
  };

  const addTask = () => {
    if (!title.trim()) return;
    api
      .createTask({
        title,
        description: "",
        status: "todo",
        priority: "medium",
        stage: "todo",
      })
      .then((t) => {
        setTasks((prev) => [t, ...prev]);
        setTitle("");
      })
      .catch((err) => console.error("Ошибка добавления задачи:", err.message));
  };

  const updateTaskFields = (id, data) =>
    api
      .updateTask(id, data)
      .then((updated) => {
        setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
        return updated;
      })
      .catch((err) => {
        console.error("Ошибка обновления задачи:", err.message);
        throw err;
      });

  const toggle = (task) => {
    const nextStatus = task.status !== "completed" ? "completed" : task.previous_status || "todo";
    return updateTaskFields(task.id, { status: nextStatus });
  };

  const remove = (id) =>
    api
      .deleteTask(id)
      .then(() => setTasks((prev) => prev.filter((t) => t.id !== id)));

  const bulkDelete = async (ids) => {
    await api.bulkDeleteTasks(ids);
    fetchTasks();
  };

  const bulkComplete = async (ids) => {
    await api.bulkStatusTasks(ids, "completed");
    fetchTasks();
  };

  const bulkAssign = async ({ ids, projectId, reassignAttached }) => {
    await api.bulkAssignTasks({
      ids,
      project_id: projectId ?? null,
      reassign_attached: Boolean(reassignAttached),
    });
    fetchTasks();
  };

  const createProjectFromTasks = async ({ project, ids, reassignAttached }) => {
    await api.createProjectFromTasks({
      project: {
        title: project.title,
        description: project.description,
        status: "active",
        priority: project.priority || "medium",
      },
      task_ids: ids,
      reassign_attached: Boolean(reassignAttached),
    });
    fetchProjects();
    fetchTasks();
  };

  const projectActions = useMemo(
    () => ({
      create: async (payload) => {
        await api.createProject(payload);
        fetchProjects();
      },
      archive: async (id) => {
        await api.archiveProject(id);
        fetchProjects();
        fetchTasks();
      },
      restore: async (id) => {
        await api.restoreProject(id);
        fetchProjects();
      },
      del: async (id) => {
        await api.deleteProject(id);
        fetchProjects();
        fetchTasks();
      },
      toggleCompleted: async (id, cascade) => {
        await api.toggleProjectCompleted(id, cascade);
        fetchProjects();
        fetchTasks();
      },
    }),
    [fetchProjects, fetchTasks]
  );

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6">Проверка авторизации...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold mb-4">Task Manager — Вход</h1>
        <input
          placeholder="Email или имя пользователя"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="border p-2 mb-2 w-full"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 mb-4 w-full"
        />
        <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 border-r border-slate-200 bg-white p-4 space-y-4">
        <div>
          <p className="text-xs uppercase text-slate-400">Навигация</p>
          <div className="mt-2 flex flex-col gap-2">
            <button
              onClick={() => setView("tasks")}
              className={`text-left px-3 py-2 rounded-lg ${
                view === "tasks" ? "bg-indigo-600 text-white" : "hover:bg-slate-100"
              }`}
            >
              Задачи
            </button>
            <button
              onClick={() => setView("projects")}
              className={`text-left px-3 py-2 rounded-lg ${
                view === "projects" ? "bg-indigo-600 text-white" : "hover:bg-slate-100"
              }`}
            >
              Проекты
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400 mb-1">Фильтр проектов</p>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Все проекты</option>
            <option value="none">Без проекта</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </aside>
      <main className="flex-1 p-6">
        {view === "projects" ? (
          <ProjectsView
            projects={projects}
            onRefresh={fetchProjects}
            onCreate={projectActions.create}
            onArchive={projectActions.archive}
            onRestore={projectActions.restore}
            onDelete={projectActions.del}
            onToggleCompleted={projectActions.toggleCompleted}
            onOpenProject={(id) => {
              setProjectFilter(String(id));
              setView("tasks");
            }}
          />
        ) : (
          <TaskDashboard
            tasks={tasks}
            setTasks={setTasks}
            title={title}
            setTitle={setTitle}
            onAddTask={addTask}
            onToggleTask={toggle}
            onDeleteTask={remove}
            onUpdateTask={updateTaskFields}
            statusFilter={status}
            setStatusFilter={setStatus}
            priorityFilter={priority}
            setPriorityFilter={setPriority}
            stageFilter={stage}
            setStageFilter={setStage}
            sortOrder={sort}
            setSortOrder={setSort}
            projects={projects}
            projectFilter={projectFilter}
            setProjectFilter={setProjectFilter}
            onBulkDelete={bulkDelete}
            onBulkComplete={bulkComplete}
            onBulkAssign={bulkAssign}
            onCreateProjectFromTasks={createProjectFromTasks}
            identifier={identifier}
          />
        )}
      </main>
    </div>
  );
}
