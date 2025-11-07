/* ---------------------------------------------------
 *  Унифицированный клиент для REST-API
 *  Все запросы идут на /api/**  – прокси Vite перенаправит на backend
 * --------------------------------------------------- */

const API = import.meta.env.VITE_API_URL || "/api";

/**
 * Базовый helper для запросов
 * -------------------------------------
 *  – добавляет Content-Type: application/json
 *  – автоматически подставляет JWT из localStorage
 *  – выбрасывает ошибку, если код ответа НЕ 2xx
 *  – безопасно обрабатывает пустые ответы (204)
 */
export async function request(url, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Если токен есть → добавляем Authorization
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${url}`, {
    headers,
    ...options,
  });

  // Если статус ответа не 2xx → выбрасываем ошибку
  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }

  // Если тело пустое → вернём null
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ----------  CRUD Задач ---------- */

// 📌 Получить список задач с фильтрами (?sort=asc&status=done...)
export const getTasks = (params) =>
  request(`/tasks${params ? `?${params}` : ""}`);

// 📌 Создать новую задачу
export const createTask = (data) =>
  request("/tasks", { method: "POST", body: JSON.stringify(data) });

// 📌 Обновить задачу (например, status → "done")
export const updateTask = (id, data) =>
  request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// 📌 Удалить задачу
export const deleteTask = (id) =>
  request(`/tasks/${id}`, { method: "DELETE" });

/* ----------  Аутентификация ---------- */

// 📌 Вход (логин) → сохраняет токен
export const login = async (identifier, password) => {
  const trimmed = (identifier || "").trim().toLowerCase();
  const payload = { password };

  if (!trimmed) {
    throw new Error("Введите email или имя пользователя");
  }

  if (trimmed.includes("@")) {
    payload.email = trimmed;
  } else {
    payload.username = trimmed;
  }

  const res = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  localStorage.setItem("token", res.token);
  return res;
};

// 📌 Регистрация (по желанию, если есть эндпоинт)
export const register = async (payloadOrEmail, username, password) => {
  let payload = payloadOrEmail;

  if (typeof payloadOrEmail !== "object" || payloadOrEmail === null) {
    payload = {
      email: payloadOrEmail,
      username,
      password,
    };
  }

  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// 📌 Выход (очистка токена)
export const logout = () => {
  localStorage.removeItem("token");
};
