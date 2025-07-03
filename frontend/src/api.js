/* ---------------------------------------------------
 *  Унифицированный клиент для REST‑API
 *  Все запросы идут на /api/**  – прокси перенаправит
 * --------------------------------------------------- */

const API = import.meta.env.VITE_API_URL || '/api';

/**
 * Базовый helper.
 *  – пробрасывает headers, method, body
 *  – бросает ошибку, если код ответа НЕ 2xx
 *  – безопасно обрабатывает ответы 204/пустое тело
 */
export async function request (url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  // Если статус неуспешный — читаем текст ошибки и бросаем исключение
  if (!res.ok) {
    throw new Error(await res.text() || `HTTP ${res.status}`);
  }

  // 204 NoContent → body пустое → вернём null
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ---------- CRUD ---------- */

// ?sort=desc&status=todo...
export const getTasks   = params        => request(`/tasks${params ? `?${params}` : ''}`);
export const createTask = data          => request('/tasks',       { method: 'POST',   body: JSON.stringify(data) });
export const updateTask = (id, data)    => request(`/tasks/${id}`, { method: 'PUT',    body: JSON.stringify(data) });
export const deleteTask = id            => request(`/tasks/${id}`, { method: 'DELETE' }); // вернёт null
