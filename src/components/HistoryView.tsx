import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  Download,
  Filter,
  Edit3,
  Clock,
  Sparkles,
  User,
  X,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { api, AttendanceRecord, Group } from '../api/client.ts';
import { exportAttendanceToCSV } from '../utils/csvExport.ts';

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isRange, setIsRange] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit record modal
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('kelgan');
  const [editReason, setEditReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const grpRes = await api.getGroups();
      setGroups(grpRes);

      const params: any = {};
      if (isRange && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      } else if (selectedDate) {
        params.date = selectedDate;
      }

      if (selectedGroupId) params.group_id = selectedGroupId;
      if (selectedStatus) params.status = selectedStatus;

      const recRes = await api.getAttendance(params);
      setRecords(recRes);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, isRange, startDate, endDate, selectedGroupId, selectedStatus]);

  const filteredRecords = records.filter(r => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${r.first_name} ${r.last_name} ${r.patronymic || ''}`.toLowerCase().includes(q);
      const matchId = (r.student_code || '').toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    exportAttendanceToCSV(
      filteredRecords.map(r => ({
        date: r.date,
        check_in_time: r.check_in_time,
        student_code: r.student_code,
        first_name: r.first_name,
        last_name: r.last_name,
        patronymic: r.patronymic,
        group_name: r.group_name,
        status: r.status,
        method: r.method,
        match_confidence: r.match_confidence,
        note: r.note
      })),
      `davomat_tarixi_${selectedDate || 'oraliq'}.csv`
    );
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setNewStatus(rec.status);
    setEditReason('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editReason.trim()) {
      alert('Davomat holatini o‘zgartirish uchun majburiy sabab kiriting.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.updateAttendance(editingRecord.id, {
        status: newStatus,
        reason: editReason
      });

      if (res.success) {
        setEditingRecord(null);
        loadData();
      } else {
        alert(res.error || 'Xatolik yuz berdi');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Davomat tarixi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Barcha kungi davomat yozuvlari, filtrlar, qo‘lda tuzatishlar va audit jurnali
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-600" />
            CSV formatida yuklab olish
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode switch: Single Date vs Range */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setIsRange(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                !isRange ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bir kunlik
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRange(true);
                if (!startDate) setStartDate(selectedDate);
                if (!endDate) setEndDate(selectedDate);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                isRange ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sana oralig‘i
            </button>
          </div>

          {!isRange ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Sana:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Boshlanish:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-mono"
              />
              <span className="text-xs text-slate-500">Tugash:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-mono"
              />
            </div>
          )}

          {/* Group Filter */}
          <div className="w-44">
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-40">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">Barcha holatlar</option>
              <option value="kelgan">Kelgan</option>
              <option value="kechikkan">Kechikkan</option>
              <option value="sababli">Sababli</option>
              <option value="kelmagan">Kelmagan</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors ml-auto"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search inside results */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="O‘quvchi ismi yoki ID bo‘yicha filtrlash..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
            <p className="font-medium text-slate-600">Davomat yozuvlari topilmadi</p>
            <p className="text-slate-400 mt-1">Tanlangan parametrlar bo‘yicha ma’lumot mavjud emas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-6">Sana va Vaqt</th>
                  <th className="py-3 px-4">O‘quvchi</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Guruh</th>
                  <th className="py-3 px-4">Holati</th>
                  <th className="py-3 px-4">Usul</th>
                  <th className="py-3 px-4">Izoh</th>
                  <th className="py-3 px-6 text-right">Tuzatish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Date & Time */}
                    <td className="py-3 px-6 font-mono tabular-nums text-slate-700">
                      <div>{rec.date}</div>
                      <div className="text-[11px] text-slate-400">{rec.check_in_time}</div>
                    </td>

                    {/* Student */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {rec.first_name} {rec.last_name}
                      </div>
                      {rec.patronymic && (
                        <div className="text-[11px] text-slate-400">{rec.patronymic}</div>
                      )}
                    </td>

                    {/* Student Code */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 tabular-nums">
                      {rec.student_code}
                    </td>

                    {/* Group */}
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {rec.group_name}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {rec.status === 'kelgan' ? (
                        <span className="text-emerald-700 font-medium">Kelgan</span>
                      ) : rec.status === 'kechikkan' ? (
                        <span className="text-amber-700 font-medium">Kechikkan</span>
                      ) : rec.status === 'sababli' ? (
                        <span className="text-blue-700 font-medium">Sababli</span>
                      ) : (
                        <span className="text-rose-700 font-medium">Kelmagan</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3 px-4 text-slate-500">
                      {rec.method === 'face_id' ? (
                        <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          Face ID ({rec.match_confidence ? Math.round(rec.match_confidence * 100) : 100}%)
                        </span>
                      ) : (
                        <span className="text-slate-600">Qo‘lda</span>
                      )}
                    </td>

                    {/* Note */}
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={rec.note || ''}>
                      {rec.note || '—'}
                    </td>

                    {/* Edit button */}
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(rec)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Davomat holatini o‘zgartirish"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                Davomat yozuvini tuzatish
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                <p>
                  <strong className="text-slate-900 font-semibold">{editingRecord.first_name} {editingRecord.last_name}</strong> ({editingRecord.student_code})
                </p>
                <p>
                  Sana: {editingRecord.date} · Joriy holat: <strong>{editingRecord.status}</strong>
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Yangi davomat holati *
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="kelgan">Kelgan</option>
                  <option value="kechikkan">Kechikkan</option>
                  <option value="sababli">Sababli (kasallik / ariza)</option>
                  <option value="kelmagan">Kelmagan</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  O‘zgartirish sababi (Audit jurnali uchun majburiy) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Masalan: Tibbiy ma’lumotnoma taqdim etildi yoki dars jarayoniga kechiktiruvchi sabab bilan ruxsat berildi"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="py-2 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {isSaving ? 'Saqlanmoqda...' : 'Tasdiqlash va saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
