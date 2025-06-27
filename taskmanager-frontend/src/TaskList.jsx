import React, { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "./api";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error("Ошибка при загрузке задач:", err);
    }
  };

  const handleAddTask = async () => {
    if (!title.trim()) return;
    try {
      await createTask({ title, checked: false });
      setTitle("");
      loadTasks();
    } catch (err) {
      console.error("Ошибка при добавлении задачи:", err);
    }
  };

  const toggleTask = async (task) => {
    try {
      await updateTask(task.id, {
        title: task.title,
        checked: !task.checked,
      });
      loadTasks();
    } catch (err) {
      console.error("Ошибка при обновлении задачи:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      loadTasks();
    } catch (err) {
      console.error("Ошибка при удалении задачи:", err);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Список задач</h1>
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Новая задача"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: "0.5rem", width: "70%" }}
        />
        <button
          onClick={handleAddTask}
          style={{ padding: "0.5rem 1rem", marginLeft: "0.5rem" }}
        >
          Добавить
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.map((task) => (
          <li key={task.id} style={{ marginBottom: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={task.checked}
                onChange={() => toggleTask(task)}
              />
              <span style={{ marginLeft: "0.5rem", flexGrow: 1 }}>
                {task.title}
              </span>
              <button
                onClick={() => handleDelete(task.id)}
                style={{ marginLeft: "auto" }}
              >
                Удалить
              </button>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
