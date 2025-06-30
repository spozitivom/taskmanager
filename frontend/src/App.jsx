import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // 🔄 Состояние задач
  const [tasks, setTasks] = useState([])

  // 🆕 Состояние новой задачи (input)
  const [newTask, setNewTask] = useState('')

  // ✏️ Для редактирования задач
  const [editId, setEditId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  // 🌍 URL бэкенда (поддерживает переменные окружения)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8081'

  // 🔽 Порядок сортировки: 'desc' (новые сначала) или 'asc' (старые сначала)
  const [sortOrder, setSortOrder] = useState('desc');

  // ✅ Обработка переключения состояния чекбокса (выполнена / не выполнена)
  const handleToggleTask = async (id, newChecked) => {
    try {
      const response = await fetch(`${apiUrl}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: newChecked }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      const updated = await response.json();
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err) {
      console.error('Ошибка при обновлении задачи:', err);
    }
  };

  // 💾 Сохранение отредактированного названия
  const handleEditSave = async (id) => {
    try {
      const response = await fetch(`${apiUrl}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      if (!response.ok) throw new Error('Ошибка при редактировании');
      const updated = await response.json();
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      setEditId(null);
      setEditTitle('');
    } catch (err) {
      console.error(err);
    }
  };

  // 📥 Загрузка задач с сортировкой (выполняется при монтировании и при смене sortOrder)
  useEffect(() => {
    fetch(`${apiUrl}/tasks?sort=${sortOrder}`)
      .then(res => res.json())
      .then(setTasks)
      .catch(err => console.error("Ошибка при получении задач:", err));
  }, [sortOrder]);

  // ➕ Добавление новой задачи
  const handleAddTask = () => {
    if (!newTask.trim()) return;
    fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTask })
    })
      .then(res => res.json())
      .then(task => {
        setTasks(prev => [task, ...prev])
        setNewTask('')
      })
      .catch(err => console.error("Ошибка при добавлении:", err))
  }

  // ❌ Удаление задачи
  const handleDelete = (id) => {
    fetch(`${apiUrl}/tasks/${id}`, {
      method: 'DELETE'
    })
      .then(() => {
        setTasks(prev => prev.filter(task => task.id !== id))
      })
      .catch(err => console.error("Ошибка при удалении:", err))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-blue-600 text-center">Список задач</h1>

      {/* 🔹 Блок добавления новой задачи */}
      <div className="flex mb-6 gap-2">
        <input
          type="text"
          className="flex-1 p-2 border rounded"
          placeholder="Новая задача"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />
        <button
          onClick={handleAddTask}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
        >
          Добавить
        </button>
      </div>

      {/* 🔽 Селектор сортировки задач */}
      <div className="mb-4 text-right">
        <label className="mr-2">Сортировка:</label>
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
      </div>

      {/* 📋 Список задач */}
      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id} className="p-2 border rounded shadow flex justify-between items-center">
            <span className="flex flex-col w-full">
              <span className="flex items-center">
                <input
                  type="checkbox"
                  checked={task.checked}
                  onChange={() => handleToggleTask(task.id, !task.checked)}
                  className="mr-2"
                />

                {editId === task.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="flex-1 border p-1 mr-2"
                    />
                    <button
                      onClick={() => handleEditSave(task.id)}
                      className="text-green-600 hover:text-green-800 mr-2"
                    >
                      💾
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{task.title}</span>
                    <button
                      onClick={() => {
                        setEditId(task.id)
                        setEditTitle(task.title)
                      }}
                      className="text-yellow-600 hover:text-yellow-800 mr-2"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </span>
              {/* 🕒 Дата создания */}
              <span className="text-sm text-gray-500 ml-6">
                {new Date(task.created_at).toLocaleString()}
              </span>
            </span>

            {/* 🗑 Кнопка удаления */}
            <button
              onClick={() => handleDelete(task.id)}
              className="text-red-600 hover:text-red-800 ml-2"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
