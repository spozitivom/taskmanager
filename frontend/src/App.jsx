import { useEffect, useState } from 'react';
import * as api from './api';

export default function App() {
  // --------------------
  // Состояния
  // --------------------
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [sort, setSort] = useState('desc');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [stage, setStage] = useState('');

  const [username, setUsername] = useState('dima');
  const [password, setPassword] = useState('123456');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // проверка токена при монтировании

  // --------------------
  // Проверка токена при старте
  // --------------------
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Пробуем загрузить задачи, если токен валиден — авторизованы
      api.getTasks()
         .then(() => setIsLoggedIn(true))
         .catch(() => {
           localStorage.removeItem('token'); // удаляем невалидный токен
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
    if (sort) params.append('sort', sort);
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (stage) params.append('stage', stage);

    api.getTasks(params.toString())
       .then(setTasks)
       .catch(err => console.error('Ошибка загрузки задач:', err.message));
  };

  useEffect(() => {
    if (isLoggedIn) fetchTasks();
  }, [sort, status, priority, stage, isLoggedIn]);

  // --------------------
  // Логин через форму
  // --------------------
  const handleLogin = async () => {
    try {
      await api.login(username, password); // сохраняет токен в localStorage
      setIsLoggedIn(true);
      fetchTasks();
    } catch (err) {
      console.error('Ошибка логина:', err.message);
      alert('Неверный логин или пароль');
    }
  };

  // --------------------
  // CRUD задачи
  // --------------------
  const addTask = () => {
    if (!title.trim()) return;
    api.createTask({ title, description: '', status: 'new', priority: 'high' })
       .then(t => { setTasks(prev => [t, ...prev]); setTitle(''); })
       .catch(err => console.error('Ошибка добавления задачи:', err.message));
  };

  const toggle = t =>
    api.updateTask(t.id, { checked: !t.checked })
       .then(u => setTasks(prev => prev.map(x => x.id === u.id ? u : x)));

  const remove = id =>
    api.deleteTask(id)
       .then(() => setTasks(prev => prev.filter(x => x.id !== id)));

  // --------------------
  // Рендер
  // --------------------
  if (loading) {
    return <div className="mx-auto max-w-3xl p-6">Проверка авторизации...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold mb-4">Task Manager — Вход</h1>
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border p-2 mb-2 w-full"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">Task Manager</h1>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={sort} onChange={e => setSort(e.target.value)} className="border p-1">
          <option value="desc">Новые → старые</option>
          <option value="asc">Старые → новые</option>
        </select>

        <select value={status} onChange={e => setStatus(e.target.value)} className="border p-1">
          <option value="">Все статусы</option>
          <option value="todo">todo</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
        </select>

        <select value={priority} onChange={e => setPriority(e.target.value)} className="border p-1">
          <option value="">Любой приоритет</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>

        <input
          value={stage}
          onChange={e => setStage(e.target.value)}
          placeholder="Этап (Фронтенд…)"
          className="border p-1 flex-1"
        />
      </div>

      {/* Добавить */}
      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border p-2"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Новая задача"
        />
        <button onClick={addTask} className="bg-blue-600 text-white px-4 rounded">
          Добавить
        </button>
      </div>

      {/* Список */}
      <ul className="space-y-2">
        {tasks.map(t => (
          <li key={t.id} className="border p-2 rounded flex justify-between items-center">
            <span>
              <input
                type="checkbox"
                checked={t.checked}
                onChange={() => toggle(t)}
                className="mr-2"
              />
              {t.title}
              <span className="text-xs text-gray-500 ml-2">
                {new Date(t.created_at).toLocaleDateString()}
              </span>
            </span>
            <button onClick={() => remove(t.id)} className="text-red-600">
              🗑
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
