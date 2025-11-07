import { useEffect, useState } from "react";
import * as api from "./api";
import TaskDashboard from "./components/TaskDashboard";

export default function App() {
  // --------------------
  // Состояния
  // --------------------
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState("desc");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [stage, setStage] = useState("");

  // Авторизация
  const [identifier, setIdentifier] = useState("dima");
  const [password, setPassword] = useState("123456");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // проверка токена при монтировании

  // --------------------
  // Проверка токена при старте
  // --------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Пробуем загрузить задачи
      api
        .getTasks()
        .then(() => setIsLoggedIn(true))
        .catch(() => {
          localStorage.removeItem("token"); // если токен невалидный — очищаем
          setIsLoggedIn(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // --------------------
  // Загрузка задач с фильтрами и сортировкой
  // --------------------
  const fetchTasks = () => {
    const params = new URLSearchParams();
    if (sort) params.append("sort", sort);
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);
    if (stage) params.append("stage", stage);

    api
      .getTasks(params.toString())
      .then(setTasks)
      .catch((err) => console.error("Ошибка загрузки задач:", err.message));
  };

  useEffect(() => {
    if (isLoggedIn) fetchTasks();
  }, [sort, status, priority, stage, isLoggedIn]);

  // --------------------
  // Логин через форму
  // --------------------
  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      alert("Введите email/username и пароль");
      return;
    }

    try {
      await api.login(identifier, password); // сохраняет токен в localStorage
      setIsLoggedIn(true);
      fetchTasks();
    } catch (err) {
      console.error("Ошибка логина:", err.message);
      alert("Неверный логин или пароль");
    }
  };

  // --------------------
  // CRUD задачи
  // --------------------
  const addTask = () => {
    if (!title.trim()) return;
    api
      .createTask({
        title,
        description: "",
        status: "todo",
        priority: "medium",
        stage: "todo", // колонка Kanban по умолчанию
        checked: false,
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
        setTasks((prev) =>
          prev.map((task) => (task.id === updated.id ? updated : task))
        );
        return updated;
      })
      .catch((err) => {
        console.error("Ошибка обновления задачи:", err.message);
        throw err;
      });

  const toggle = (t) => updateTaskFields(t.id, { checked: !t.checked });

  const remove = (id) =>
    api
      .deleteTask(id)
      .then(() => setTasks((prev) => prev.filter((x) => x.id !== id)));

  // --------------------
  // Рендер
  // --------------------
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">Проверка авторизации...</div>
    );
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
          className="border p-2 mb-2 w-full"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          Войти
        </button>
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
      identifier={identifier}
    />
  );
}
