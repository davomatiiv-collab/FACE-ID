import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Users,
  UserCheck,
  UserX,
  ArrowRightLeft,
  X,
  Eye,
  RefreshCw
} from 'lucide-react';
import { api, Group, Student } from '../api/client.ts';

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');

  // Form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [grpRes, stuRes] = await Promise.all([
        api.getGroups(),
        api.getStudents()
      ]);
      const sortedGroups = [...grpRes].sort((a, b) => {
        const [aMaj, aMin] = a.name.split('.').map(Number);
        const [bMaj, bMin] = b.name.split('.').map(Number);
        if (!isNaN(aMaj) && !isNaN(bMaj) && !isNaN(aMin) && !isNaN(bMin)) {
          if (aMaj !== bMaj) return aMaj - bMaj;
          return aMin - bMin;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      setGroups(sortedGroups);
      setAllStudents(stuRes);
      if (sortedGroups.length > 0 && !targetGroupId) {
        setTargetGroupId(sortedGroups[0].id);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingGroup(null);
    setName('');
    setDescription('');
    setShowAddModal(true);
  };

  const openEditModal = (grp: Group) => {
    setEditingGroup(grp);
    setName(grp.name);
    setDescription(grp.description || '');
    setShowAddModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingGroup) {
        const res = await api.updateGroup(editingGroup.id, name, description);
        if (res.success) {
          setShowAddModal(false);
          loadData();
        } else {
          alert(res.error || 'Xatolik yuz berdi');
        }
      } else {
        const res = await api.createGroup(name, description);
        if (res.success) {
          setShowAddModal(false);
          loadData();
        } else {
          alert(res.error || 'Xatolik yuz berdi');
        }
      }
    } catch (err: any) {
      alert('Xatolik: ' + err.message);
    }
  };

  const handleArchiveGroup = async (grp: Group) => {
    if (!confirm(`"${grp.name}" guruhini arxivlashni xohlaysizmi? O‘quvchilar va ularning avvalgi davomat tarixi saqlanadi.`)) {
      return;
    }
    try {
      await api.archiveGroup(grp.id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransferStudent = async () => {
    if (!transferringStudent || !targetGroupId) return;
    try {
      const res = await api.transferStudent(transferringStudent.id, targetGroupId);
      if (res.success) {
        setTransferringStudent(null);
        loadData();
      } else {
        alert(res.error || 'Xatolik yuz berdi');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const groupStudents = viewingGroup
    ? allStudents.filter(s => s.group_id === viewingGroup.id && s.is_active)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Guruhlar boshqaruvi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Akademik litsey guruhlarini shakllantirish, o‘quvchilar tarkibini ko‘rish va guruhlararo ko‘chirish
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openAddModal}
            className="py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Yangi guruh ochish
          </button>
        </div>
      </div>

      {/* Groups Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map(grp => (
          <div
            key={grp.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {grp.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Tashkil etilgan: {grp.created_at.split('T')[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(grp)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Tahrirlash"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveGroup(grp)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                    title="Arxivlash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {grp.description && (
                <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                  {grp.description}
                </p>
              )}
            </div>

            {/* Attendance & Count Strip */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 mb-0.5">
                  <Users className="w-3 h-3" />
                  <span>Jami</span>
                </div>
                <div className="font-mono font-bold text-slate-800 text-sm tabular-nums">
                  {grp.total_students}
                </div>
              </div>

              <div className="bg-emerald-50 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-700 mb-0.5">
                  <UserCheck className="w-3 h-3" />
                  <span>Kelgan</span>
                </div>
                <div className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                  {grp.present_today}
                </div>
              </div>

              <div className="bg-rose-50 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-rose-700 mb-0.5">
                  <UserX className="w-3 h-3" />
                  <span>Kelmagan</span>
                </div>
                <div className="font-mono font-bold text-rose-700 text-sm tabular-nums">
                  {grp.absent_today}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewingGroup(grp)}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              O‘quvchilar ro‘yxati ({grp.total_students})
            </button>
          </div>
        ))}
      </div>

      {/* Add / Edit Group Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingGroup ? 'Guruhni tahrirlash' : 'Yangi guruh ochish'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Guruh nomi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: 103-Ijtimoiy fanlar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Guruh tavsifi
                </label>
                <textarea
                  rows={3}
                  placeholder="Tarix va huquq yo‘nalishi chuqurlashtirilgan guruhi"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {editingGroup ? 'Saqlash' : 'Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Group Students Modal */}
      {viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {viewingGroup.name} o‘quvchilari
                </h3>
                <p className="text-xs text-slate-500">Jami: {groupStudents.length} nafar faol o‘quvchi</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingGroup(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {groupStudents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Ushbu guruhga hali o‘quvchilar biriktirilmagan
                </p>
              ) : (
                groupStudents.map(st => (
                  <div key={st.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-xs text-slate-600">
                        {st.photo_url ? (
                          <img src={st.photo_url} alt={st.first_name} className="w-full h-full object-cover" />
                        ) : (
                          st.first_name[0]
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {st.first_name} {st.last_name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">ID: {st.student_id}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTransferringStudent(st)}
                      className="py-1 px-2.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1"
                      title="Boshqa guruhga ko‘chirish"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Ko‘chirish
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingGroup(null)}
                className="py-1.5 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Student Modal */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                O‘quvchini boshqa guruhga ko‘chirish
              </h3>
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                <strong className="text-slate-900 font-semibold">{transferringStudent.first_name} {transferringStudent.last_name}</strong> ni quyidagi yangi guruhga o‘tkazasizmi?
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Yangi guruhni tanlang:
                </label>
                <select
                  value={targetGroupId}
                  onChange={e => setTargetGroupId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {groups
                    .filter(g => g.id !== transferringStudent.group_id)
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-400">
                Eslatma: O‘quvchining avvalgi davomat tarixi to‘liq saqlanib qoladi.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferringStudent(null)}
                  className="py-2 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleTransferStudent}
                  className="py-2 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Ko‘chirish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
