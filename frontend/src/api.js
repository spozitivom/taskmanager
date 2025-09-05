/* ---------------------------------------------------
 *  Унифицированный клиент для REST‑API
 *  Все запросы идут на /api/**  – прокси Vite перенаправит на backend
 * --------------------------------------------------- */

const API = import.meta.env.VITE_API_URL || '/api';

/**
 * Базовый helper.
 *  – пробрасывает headers, method, body
 *  – автоматически добавляет JWT из localStorage
 *  – бросает ошибку, если код ответа НЕ 2xx
 *  – безопасно обрабатывает ответы 204/пустое тело
 */
export async function request(url, options = {}) {
  // Берём токен после логина
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Если токен есть — добавляем Authorization
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${url}`, {
    headers,
    ...options,
  });

  // Если статус ответа не 2xx — выбрасываем ошибку
  if (!res.ok) {
    throw new Error(await res.text() || `HTTP ${res.status}`);
  }

  // Если тело пустое → вернём null
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ---------- CRUD ---------- */

// Получить список задач с фильтрами (опционально)
export const getTasks   = params        => request(`/tasks${params ? `?${params}` : ''}`);

// Создать новую задачу
export const createTask = data          => request('/tasks',       { method: 'POST', body: JSON.stringify(data) });

// Обновить задачу
export const updateTask = (id, data)    => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Удалить задачу
export const deleteTask = id            => request(`/tasks/${id}`, { method: 'DELETE' });

// Авторизация (логин)
export const login = async (username, password) => {
  const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  localStorage.setItem('token', res.token); // сохраняем токен для всех будущих запросов
  return res;
};

