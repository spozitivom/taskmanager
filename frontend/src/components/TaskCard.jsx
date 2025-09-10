import React from "react";
import * as api from "../api";

export default function TaskCard({ task, setTasks }) {
  // Смена стадии задачи (todo → in_progress → done)
  const updateStage = async (newStage) => {
    try {
      const updated = await api.updateTask(task.id, { stage: newStage });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      console.error("Ошибка обновления стадии:", err.message);
    }
  };

  // Удаление задачи
  const removeTask = async () => {
    try {
      await api.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      console.error("Ошибка удаления задачи:", err.message);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-3 mb-2">
      {/* Заголовок */}
      <h3 className="font-semibold text-gray-800">{task.title}</h3>

      {/* Описание */}
      {task.description && (
        <p className="text-sm text-gray-500">{task.description}</p>
      )}

      {/* Доп. инфа */}
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>Priority: {task.priority || "—"}</span>
        <span>{new Date(task.created_at).toLocaleDateString()}</span>
      </div>

      {/* Кнопки действий */}
      <div className="flex gap-2 mt-3">
        {/* Перевести задачу в работу */}
        {task.stage !== "in_progress" && (
          <button
            onClick={() => updateStage("in_progress")}
            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded"
          >
            ⏳ В работу
          </button>
        )}

        {/* Завершить задачу */}
        {task.stage !== "done" && (
          <button
            onClick={() => updateStage("done")}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded"
          >
            ✔ Завершить
          </button>
        )}

        {/* Вернуть в todo */}
        {task.stage !== "todo" && (
          <button
            onClick={() => updateStage("todo")}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          >
            ↩ В ToDo
          </button>
        )}

        {/* Удаление */}
        <button
          onClick={removeTask}
          className="px-2 py-1 text-xs bg-red-600 text-white rounded"
        >
          🗑 Удалить
        </button>
      </div>
    </div>
  );
}
