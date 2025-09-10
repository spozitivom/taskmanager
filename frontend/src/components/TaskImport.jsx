import { useRef } from 'react';
import Papa from 'papaparse';
import * as api from '../api';

export default function TaskImport({ setTasks }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;

        const newTasks = [];
        for (const row of rows) {
          const title = row.title?.trim();
          if (!title) continue;

          try {
            const created = await api.createTask({
              title,
              description: row.description || '',
              status: row.status || 'new',
              priority: row.priority || 'medium',
              stage: row.stage || ''
            });
            newTasks.push(created);
          } catch (err) {
            console.error('Ошибка при добавлении задачи:', err.message);
          }
        }

        setTasks(prev => [...newTasks, ...prev]);
        alert(`${newTasks.length} задач импортировано`);
        fileInputRef.current.value = ''; // сброс выбора файла
      },
      error: (err) => {
        console.error('Ошибка парсинга CSV:', err.message);
        alert('Ошибка при импорте CSV');
      }
    });
  };

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Импорт задач из CSV:</label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="border p-1"
      />
    </div>
  );
}
