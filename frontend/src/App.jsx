import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import TaskDashboard from "./components/TaskDashboard";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState("desc");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [stage, setStage] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [projects, setProjects] = useState([]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchProjects = useCallback(() => {
    return api
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

    return api
      .getTasks(params.toString())
      .then(setTasks)
      .catch((err) => console.error("Ошибка загрузки задач:", err.message));
  }, [sort, status, priority, stage, projectFilter]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await api.getProfile();
      setUser(profile);
      setIsLoggedIn(true);
    } catch (err) {
      localStorage.removeItem("token");
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    bootstrap();
  }, [bootstrap]);

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
      await bootstrap();
    } catch (err) {
      console.error("Ошибка логина:", err.message);
      alert("Неверный логин или пароль");
    }
  };

  const handleRegister = async () => {
    if (!regEmail.trim() && !regUsername.trim()) {
      alert("Введите email или имя пользователя");
      return;
    }
    if (!regPassword.trim()) {
      alert("Введите пароль");
      return;
    }
    if (regPassword !== regConfirm) {
      alert("Пароли не совпадают");
      return;
    }
    try {
      await api.register({
        email: regEmail || undefined,
        username: regUsername || undefined,
        password: regPassword,
      });
      await api.login(regEmail || regUsername, regPassword);
      await bootstrap();
    } catch (err) {
      alert(err.message || "Ошибка регистрации");
    }
  };

  const loginDisabled = !identifier.trim() || !password.trim();
  const registerDisabled =
    (!regEmail.trim() && !regUsername.trim()) || !regPassword.trim() || regPassword !== regConfirm;

  const handleLogout = () => {
    api.logout();
    setIsLoggedIn(false);
    setTasks([]);
    setProjects([]);
    setUser(null);
  };

  const addTask = () => {
    if (!title.trim()) return;
    const projectId = projectFilter && projectFilter !== "none" ? Number(projectFilter) : null;
    api
      .createTask({
        title,
        description: "",
        status: "todo",
        priority: "medium",
        stage: "todo",
        project_id: projectId,
        start_at: null,
        end_at: null,
        all_day: false,
      })
      .then((t) => {
        setTasks((prev) => [t, ...prev]);
        setTitle("");
      })
      .catch((err) => console.error("Ошибка добавления задачи:", err.message));
  };

  const createTaskAtDate = async ({ title, date, projectId }) => {
    if (!title?.trim()) {
      return null;
    }
    const resolvedProjectId =
      projectId !== undefined
        ? projectId
        : projectFilter && projectFilter !== "none"
        ? Number(projectFilter)
        : null;

    const startAt = date ? new Date(`${date}T00:00:00Z`).toISOString() : null;
    const payload = {
      title: title.trim(),
      description: "",
      status: "todo",
      priority: "medium",
      stage: "todo",
      project_id: resolvedProjectId,
      start_at: startAt,
      end_at: startAt,
      all_day: Boolean(startAt),
    };

    try {
      const created = await api.createTask(payload);
      setTasks((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error("Ошибка добавления задачи из календаря:", err.message);
      throw err;
    }
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
    await fetchTasks();
    try {
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
      const updated = await api.getTasks(params.toString());
      setTasks(updated);
    } catch (error) {
      console.error("Не удалось обновить список задач:", error);
    }
  };

  const projectActions = useMemo(
    () => ({
      create: async (payload) => {
        const created = await api.createProject(payload);
        fetchProjects();
        fetchTasks();
        return created;
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
      update: async (id, payload) => {
        await api.updateProject(id, payload);
        fetchProjects();
        fetchTasks();
      },
    }),
    [fetchProjects, fetchTasks]
  );

  const handleUserChange = (payload) => {
    setUser(payload);
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6">Проверка авторизации...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Task Manager</h1>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode("login")}
              className={`px-3 py-1 rounded-lg border ${mode === "login" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200"}`}
            >
              Вход
            </button>
            <button
              onClick={() => setMode("register")}
              className={`px-3 py-1 rounded-lg border ${mode === "register" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200"}`}
            >
              Регистрация
            </button>
          </div>
        </div>

        {mode === "login" ? (
          <>
            <input
              placeholder="Email или имя пользователя"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="border p-2 mb-2 w-full rounded"
            />
            <input
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 mb-4 w-full rounded"
            />
            <button
              onClick={handleLogin}
              disabled={loginDisabled}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60"
            >
              Войти
            </button>
          </>
        ) : (
          <>
            <input
              placeholder="Email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="border p-2 mb-2 w-full rounded"
            />
            <input
              placeholder="Имя пользователя"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              className="border p-2 mb-2 w-full rounded"
            />
            <input
              placeholder="Пароль"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className="border p-2 mb-2 w-full rounded"
            />
            <input
              placeholder="Подтверждение пароля"
              type="password"
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              className="border p-2 mb-4 w-full rounded"
            />
            <button
              onClick={handleRegister}
              disabled={registerDisabled}
              className="bg-green-600 text-white px-4 py-2 rounded w-full disabled:opacity-60"
            >
              Зарегистрироваться
            </button>
          </>
        )}
      </div>
    );
  }

  return (
      <TaskDashboard
        tasks={tasks}
        setTasks={setTasks}
        title={title}
      setTitle={setTitle}
      onAddTask={addTask}
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
      onCreateTaskAtDate={createTaskAtDate}
      user={user}
      onUserChange={handleUserChange}
      onLogout={handleLogout}
      onProjectCreate={projectActions.create}
      onProjectArchive={projectActions.archive}
      onProjectRestore={projectActions.restore}
      onProjectDelete={projectActions.del}
      onProjectToggleCompleted={projectActions.toggleCompleted}
      onProjectUpdate={projectActions.update}
      onProjectsRefresh={fetchProjects}
    />
  );
}
