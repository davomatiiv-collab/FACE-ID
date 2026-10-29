import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Shield,
  KeyRound,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  LogOut,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { api, SystemSettings, AuditLog } from '../api/client.ts';

interface SettingsViewProps {
  adminUser: { id: string; username: string; full_name: string; role: string } | null;
  onLogout: () => void;
  onLogin: (user: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  adminUser,
  onLogout,
  onLogin
}) => {
  const [settings, setSettings] = useState<SystemSettings>({
    id: 'default',
    school_name: 'Akademik Litsey — Face ID Davomat Tizimi',
    start_time: '08:30',
    late_threshold_minutes: 15,
    face_match_threshold: 0.75,
    require_manual_confirm_on_low_confidence: 1,
    enable_liveness_check: 1
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password change state
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Backup restore file input
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [setRes, logsRes] = await Promise.all([
        api.getSettings(),
        api.getAuditLogs()
      ]);
      if (setRes) setSettings(setRes);
      setAuditLogs(logsRes);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        loadData();
      } else {
        alert(res.error || 'Sozlamalarni saqlashda xatolik');
      }
    } catch (err: any) {
      alert('Xatolik: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!adminUser) return;
    if (newPassword !== confirmPassword) {
      setPwdMsg({ text: 'Yangi parollar mos kelmadi', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ text: 'Parol kamida 6 ta belgidan iborat bo‘lishi lozim', type: 'error' });
      return;
    }

    try {
      const res = await api.changePassword({
        username: adminUser.username,
        current_password: currPassword,
        new_password: newPassword
      });
      if (res.success) {
        setPwdMsg({ text: 'Parol muvaffaqiyatli yangilandi va xeshlandi', type: 'success' });
        setCurrPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdMsg({ text: res.error || 'Parol noto‘g‘ri', type: 'error' });
      }
    } catch (err: any) {
      setPwdMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await api.login(loginUsername, loginPassword);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setLoginError(res.error || 'Login yoki parol noto‘g‘ri');
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/backup/download';
  };

  const handleDownloadJsonBackup = () => {
    window.location.href = '/api/backup/json';
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Haqiqatan ham ushbu zaxira nusxasini tiklashni xohlaysizmi? Joriy o‘zgarishlar zaxira ma’lumotlari bilan almashtiriladi.')) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    const reader = new FileReader();

    if (file.name.endsWith('.sqlite')) {
      reader.onload = async ev => {
        try {
          const arrayBuffer = ev.target?.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const res = await api.restoreBackup({ base64Data: base64 });
          if (res.success) {
            alert('SQLite ma’lumotlar bazasi zaxira nusxadan tiklandi!');
            window.location.reload();
          } else {
            alert(res.error || 'Tiklashda xatolik');
          }
        } catch (err: any) {
          alert('Faylni o‘qishda xatolik: ' + err.message);
        } finally {
          setRestoring(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = async ev => {
        try {
          const jsonText = ev.target?.result as string;
          const parsed = JSON.parse(jsonText);
          const res = await api.restoreBackup({ jsonData: parsed.data || parsed });
          if (res.success) {
            alert('JSON ma’lumotlar muvaffaqiyatli tiklandi!');
            window.location.reload();
          } else {
            alert(res.error || 'Tiklashda xatolik');
          }
        } catch (err: any) {
          alert('JSON fayl xatosi: ' + err.message);
        } finally {
          setRestoring(false);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Administrator sozlamalari
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Davomat qoidalari, aniqlik chegarasi, xavfsizlik, zaxiralash va audit jurnali
          </p>
        </div>

        {adminUser && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              Faol foydalanuvchi: <strong className="text-slate-900 font-semibold">{adminUser.full_name}</strong>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="py-1.5 px-3 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Chiqish
            </button>
          </div>
        )}
      </div>

      {/* If not logged in, prompt authentication */}
      {!adminUser ? (
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Administrator kirishi</h3>
            <p className="text-xs text-slate-500">
              Tizim sozlamalari va zaxira funksiyalaridan foydalanish uchun tizimga kiring
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Login
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Parol
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Standart parol: litsey2026"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
            >
              {isLoggingIn ? 'Tekshirilmoqda...' : 'Tizimga kirish'}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Attendance & Recognition Rules */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Davomat va Face ID qoidalari
                </h3>
              </div>

              {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sozlamalar muvaffaqiyatli yangilandi va saqlandi!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Muassasa nomi
                  </label>
                  <input
                    type="text"
                    value={settings.school_name}
                    onChange={e => setSettings({ ...settings, school_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Dars boshlanish vaqti
                    </label>
                    <input
                      type="time"
                      value={settings.start_time}
                      onChange={e => setSettings({ ...settings, start_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Kechikish chegarasi (daqiqa)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={settings.late_threshold_minutes}
                      onChange={e => setSettings({ ...settings, late_threshold_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 uppercase">
                      Face ID aniqlik chegarasi
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      {Math.round(settings.face_match_threshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.60}
                    max={0.95}
                    step={0.01}
                    value={settings.face_match_threshold}
                    onChange={e => setSettings({ ...settings, face_match_threshold: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>60% (Yumshoq)</span>
                    <span>75% (Tavsiya etiladi)</span>
                    <span>95% (Yuqori qat’iylik)</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.require_manual_confirm_on_low_confidence)}
                      onChange={e => setSettings({ ...settings, require_manual_confirm_on_low_confidence: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-medium text-slate-900 block">
                        Ishonchlilik chegarada bo‘lsa, qo‘lda tasdiqlash
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Tanish aniqligi chegara atrofida bo‘lganda xato qayd etilishining oldini oladi.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enable_liveness_check)}
                      onChange={e => setSettings({ ...settings, enable_liveness_check: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-medium text-slate-900 block">
                        Tiriklik mikro-harakatini tekshirish (Liveness check)
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Statik fotosuratlar orqali aldashdan ogohlantiruvchi dinamik piksel tahlili.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                  >
                    {savingSettings ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Administrator parolini o‘zgartirish
                </h3>
              </div>

              {pwdMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    pwdMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {pwdMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{pwdMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Joriy parol
                  </label>
                  <input
                    type="password"
                    required
                    value={currPassword}
                    onChange={e => setCurrPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Yangi parol
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Takrorlang
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="py-2 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Parolni yangilash
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Backup, Privacy & Audit Trail */}
          <div className="space-y-6">
            {/* Backup & Restore Card (Section 13) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Lokal bazani zaxiralash va tiklash
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                O‘quvchilar ro‘yxati, guruhlar, biometrik yuz shablonlari va butun davomat tarixini to‘liq saqlash. Kompyuter formati yoki nosozlik holatlarida qayta tiklash mumkin.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="py-2.5 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  SQLite (.sqlite) yuklash
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="py-2.5 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  JSON nusxasi
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sqlite,.json"
                  onChange={handleFileRestore}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={restoring}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {restoring ? 'Qayta tiklanmoqda...' : 'Zaxira faylidan bazani tiklash'}
                </button>
              </div>
            </div>

            {/* Offline & Privacy Governance Card (Section 11 & 12) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>To‘liq oflayn va biometrik xavfsizlik</span>
              </div>

              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Barcha biometrik parametrlar shaxsiy kompyuter xotirasidagi lokal SQLite faylida saqlanadi.</li>
                <li>Hech qanday tashqi bulut, CDN yoki uchinchi tomon serverlariga ulanish mavjud emas.</li>
                <li>Internet uzilgan holatda ham dastur 100% to‘liq ishlashda davom etadi.</li>
                <li>Administrator istalgan vaqtda o‘quvchi yuz shablonini o‘chirish yoki yangilash huquqiga ega.</li>
              </ul>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">
                  Tizim audit jurnali (Oxirgi amallar)
                </h4>
                <button
                  type="button"
                  onClick={loadData}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                {auditLogs.length === 0 ? (
                  <p className="py-6 text-center text-slate-400 text-xs">Audit yozuvlari mavjud emas</p>
                ) : (
                  auditLogs.map(log => (
                    <div key={log.id} className="p-3 hover:bg-slate-50/70">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono">{log.created_at.replace('T', ' ').slice(0, 19)}</span>
                        <span className="capitalize">{log.action.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5 font-medium">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
