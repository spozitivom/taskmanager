import { forwardRef, useImperativeHandle, useRef } from "react";
import Papa from "papaparse";
import * as api from "../api";

/**
 * Компонент импорта задач из CSV.
 * Принимает renderTrigger для кастомной кнопки/контрола.
 */
const TaskImport = forwardRef(function TaskImport(
  { setTasks, renderTrigger, className, showDefaultTrigger = true },
  ref
) {
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open: () => fileInputRef.current?.click(),
  }));

  const handlePick = () => fileInputRef.current?.click();

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
              description: row.description || "",
              status: row.status || "todo",
              priority: row.priority || "medium",
              stage: row.stage || row.status || "todo",
              checked: false,
            });
            newTasks.push(created);
          } catch (err) {
            console.error("Ошибка при добавлении задачи:", err.message);
          }
        }

        setTasks((prev) => [...newTasks, ...prev]);
        alert(`${newTasks.length} задач импортировано`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        console.error("Ошибка парсинга CSV:", err.message);
        alert("Ошибка при импорте CSV");
      },
    });
  };

  let trigger = null;
  if (typeof renderTrigger === "function") {
    trigger = renderTrigger({ onClick: handlePick });
  } else if (showDefaultTrigger) {
    trigger = (
      <button
        type="button"
        onClick={handlePick}
        className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm"
      >
        Импорт CSV
      </button>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      {trigger}
    </div>
  );
});

export default TaskImport;
