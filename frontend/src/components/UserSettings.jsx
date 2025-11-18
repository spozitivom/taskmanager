import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Loader2, LogOut, Moon, ShieldCheck, Sun, Trash2, Upload, X } from "lucide-react";
import * as api from "../api";

const AVATAR_LIMIT = 2 * 1024 * 1024; // 2 МБ

export default function UserSettings({ user, onUserChange, onLogout }) {
  const [profileForm, setProfileForm] = useState({ fullName: "", email: "" });
  const avatar = useAvatarUpload({ initialUrl: user?.avatar_url });
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [settingsForm, setSettingsForm] = useState({ language: "en", theme: "light" });
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setProfileForm({
      fullName: user?.full_name || "",
      email: user?.email || "",
    });
    avatar.reset(user?.avatar_url || "");
    setSettingsForm({
      language: user?.language || "en",
      theme: user?.theme || "light",
    });
  }, [user, avatar]);

  const handleProfileSave = async () => {
    setProfileStatus(null);
    setProfileLoading(true);
    try {
      const payload = { full_name: profileForm.fullName };
      if (avatar.payload !== undefined) {
        payload.avatar = avatar.payload;
      }
      if (avatar.remove) {
        payload.remove_avatar = true;
      }
      const updated = await api.updateProfile(payload);
      onUserChange?.(updated);
      setProfileStatus({ type: "success", message: "Профиль сохранён" });
      avatar.markSaved();
    } catch (err) {
      setProfileStatus({ type: "error", message: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordStatus(null);
    setPasswordLoading(true);
    try {
      await api.updatePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        confirm_password: passwordForm.confirm,
      });
      setPasswordStatus({ type: "success", message: "Пароль обновлён" });
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPasswordStatus({ type: "error", message: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSettingsSave = async () => {
    setSettingsStatus(null);
    setSettingsLoading(true);
    try {
      const updated = await api.updateSettings({
        language: settingsForm.language,
        theme: settingsForm.theme,
      });
      onUserChange?.(updated);
      setSettingsStatus({ type: "success", message: "Настройки сохранены" });
    } catch (err) {
      setSettingsStatus({ type: "error", message: err.message });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus(null);
    setDeleteLoading(true);
    try {
      await api.deleteAccount(deleteConfirm.trim());
      api.logout();
      onLogout?.();
      window.location.href = "/login";
    } catch (err) {
      setDeleteStatus({ type: "error", message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const canDelete = useMemo(
    () => deleteConfirm === "DELETE" || deleteConfirm === (user?.email || ""),
    [deleteConfirm, user?.email]
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Профиль</p>
          <h1 className="text-2xl font-semibold text-slate-800">Настройки пользователя</h1>
        </div>
        <ShieldCheck className="h-6 w-6 text-emerald-500" />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            {avatar.preview ? (
              <img
                src={avatar.preview}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-100"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 text-indigo-500 flex items-center justify-center text-2xl font-semibold">
                {profileForm.fullName?.slice(0, 1).toUpperCase() || "U"}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              onChange={avatar.handleSelect(setProfileStatus)}
            />
          </div>
          <div className="space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" /> Загрузить
            </button>
            <button
              onClick={() => avatar.reset("")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-600">
            <span>Full Name</span>
            <input
              value={profileForm.fullName}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
              placeholder="Введите имя"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-600">
            <span>Email</span>
            <input
              value={profileForm.email}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">Изменения сохранятся после нажатия на кнопку.</div>
          <div className="flex items-center gap-2">
            {profileStatus && <StatusNote status={profileStatus} />}
            <button
              onClick={handleProfileSave}
              disabled={profileLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {profileLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить профиль
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Смена пароля</h3>
          <p className="text-sm text-slate-500">Минимальная длина — 6 символов.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <PasswordField
            label="Текущий пароль"
            value={passwordForm.current}
            onChange={(value) => setPasswordForm((prev) => ({ ...prev, current: value }))}
          />
          <PasswordField
            label="Новый пароль"
            value={passwordForm.next}
            onChange={(value) => setPasswordForm((prev) => ({ ...prev, next: value }))}
          />
          <PasswordField
            label="Подтверждение"
            value={passwordForm.confirm}
            onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirm: value }))}
          />
        </div>
        <div className="flex items-center justify-between">
          {passwordStatus && <StatusNote status={passwordStatus} />}
          <button
            onClick={handlePasswordChange}
            disabled={passwordLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Изменить пароль
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Язык интерфейса</h3>
            <p className="text-sm text-slate-500">Сохраняется в профиле пользователя.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-600">
            <span>Language</span>
            <select
              value={settingsForm.language}
              onChange={(e) => setSettingsForm((prev) => ({ ...prev, language: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-600">
            <span>Тема интерфейса</span>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={settingsForm.theme === "light"}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, theme: e.target.value }))}
                />
                <Sun className="h-4 w-4 text-amber-500" /> Light
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={settingsForm.theme === "dark"}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, theme: e.target.value }))}
                />
                <Moon className="h-4 w-4 text-slate-600" /> Dark
              </label>
              <label className="flex items-center gap-2 text-sm opacity-60">
                <input type="radio" name="theme" value="system" disabled />
                System
              </label>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          {settingsStatus && <StatusNote status={settingsStatus} />}
          <button
            onClick={handleSettingsSave}
            disabled={settingsLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {settingsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Сохранить настройки
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Аккаунт</h3>
            <p className="text-sm text-slate-500">Управление сессией и удаление профиля.</p>
          </div>
          <LogOut className="h-5 w-5 text-rose-500" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
          <div className="flex-1" />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-600">
              Для удаления введите слово DELETE или свой email:
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 shadow-inner shadow-slate-50 focus:border-rose-300 focus:outline-none"
                placeholder="DELETE"
              />
              <button
                onClick={() => setDeleteModal(true)}
                disabled={!canDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" /> Удалить аккаунт
              </button>
            </div>
            {deleteStatus && <StatusNote status={deleteStatus} />}
          </div>
        </div>
      </section>

      {deleteModal && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-800">Подтверждение удаления</h4>
                <p className="text-sm text-slate-500">Это действие необратимо.</p>
              </div>
              <button
                onClick={() => setDeleteModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Введите <span className="font-semibold">DELETE</span> или email <span className="font-semibold">{user?.email}</span> для подтверждения.
              </p>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 shadow-inner shadow-slate-50 focus:border-rose-300 focus:outline-none"
                placeholder="DELETE"
              />
            </div>
            {deleteStatus && <StatusNote status={deleteStatus} />}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!canDelete || deleteLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Удалить аккаунт
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusNote({ status }) {
  if (!status) return null;
  const tone =
    status.type === "success"
      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
      : "text-rose-600 bg-rose-50 border-rose-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {status.type === "success" ? "✓" : "!"} {status.message}
    </span>
  );
}

function PasswordField({ label, value, onChange }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-600">
      <span>{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 shadow-inner shadow-slate-50 focus:border-indigo-400 focus:outline-none"
        minLength={6}
      />
    </label>
  );
}

function useAvatarUpload({ initialUrl = "" } = {}) {
  const [preview, setPreview] = useState(initialUrl || "");
  const [payload, setPayload] = useState(undefined);
  const [remove, setRemove] = useState(false);

  const handleSelect = (setStatus) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus?.({ type: "error", message: "Поддерживаются jpg, png или webp" });
      return;
    }
    if (file.size > AVATAR_LIMIT) {
      setStatus?.({ type: "error", message: "Аватар должен быть не больше 2 МБ" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result?.toString() || "";
      setPreview(data);
      setPayload(data);
      setRemove(false);
      setStatus?.(null);
    };
    reader.readAsDataURL(file);
  };

  const reset = (nextUrl = "") => {
    setPreview(nextUrl);
    setPayload(undefined);
    setRemove(!nextUrl);
  };

  const markSaved = () => {
    setPayload(undefined);
    setRemove(false);
  };

  return { preview, payload, remove, handleSelect, reset, markSaved };
}
