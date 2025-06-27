const API_URL = "http://localhost:3000";

// Универсальный хелпер
async function request(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8", // ⚠️ важно: указываем явно UTF-8
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ошибка ${res.status}: ${errorText}`);
    }

    return res.json();
  } catch (err) {
    console.error("Ошибка при запросе:", err.message);
    throw err;
  }
}

// Получение всех задач
export async function getTasks() {
  return request("/tasks");
}

// Создание новой задачи
export async function createTask(task) {
  return request("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

// Обновление задачи
export async function updateTask(id, updatedTask) {
  return request(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(updatedTask),
  });
}

// Удаление задачи
export async function deleteTask(id) {
  return request(`/tasks/${id}`, {
    method: "DELETE",
  });
}
