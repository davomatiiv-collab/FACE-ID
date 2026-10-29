import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Camera,
  Trash2,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  Upload,
  CheckCircle2,
  Filter,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api, Student, Group } from '../api/client.ts';
import { FaceRegistrationModal } from './FaceRegistrationModal.tsx';
import { extractDescriptorFromImageUrl, extractFaceDescriptor, detectFace } from '../utils/faceRecognition.ts';

export const StudentsView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractedDescriptor, setExtractedDescriptor] = useState<number[] | null>(null);
  const [isExtractingFace, setIsExtractingFace] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedFaceStatus, setSelectedFaceStatus] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [faceEnrollingStudent, setFaceEnrollingStudent] = useState<Student | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    student_id: string;
    first_name: string;
    last_name: string;
    patronymic: string;
    group_id: string;
    photo_url: string;
  }>({
    student_id: '',
    first_name: '',
    last_name: '',
    patronymic: '',
    group_id: '',
    photo_url: ''
  });

  // Photo mode: 'file' (upload from PC) or 'camera' (take photo with camera)
  const [photoMode, setPhotoMode] = useState<'file' | 'camera'>('file');
  const [modalCameraActive, setModalCameraActive] = useState(false);
  const [modalCameraError, setModalCameraError] = useState<string | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalStreamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopModalCamera = useCallback(() => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach(t => t.stop());
      modalStreamRef.current = null;
    }
    if (modalVideoRef.current) {
      modalVideoRef.current.srcObject = null;
    }
    setModalCameraActive(false);
  }, []);

  const attachStreamToVideo = useCallback(() => {
    if (modalVideoRef.current && modalStreamRef.current) {
      modalVideoRef.current.srcObject = modalStreamRef.current;
      modalVideoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, []);

  useEffect(() => {
    if (modalCameraActive) {
      attachStreamToVideo();
    }
  }, [modalCameraActive, attachStreamToVideo]);

  const startModalCamera = useCallback(async () => {
    try {
      setModalCameraError(null);
      stopModalCamera();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch {
        // Fallback to simple video: true if ideal dimensions or facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      modalStreamRef.current = stream;
      setModalCameraActive(true);
      // Wait for next tick so DOM element renders
      setTimeout(() => {
        attachStreamToVideo();
      }, 50);
    } catch (err: any) {
      console.error('Modal camera error:', err);
      let msg = 'Kamerani yoqib bo‘lmadi.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Kamera ruxsati rad etildi. Brauzer manzil satrida ruxsatni yoqing.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kompyuteringizda vebkamera topilmadi.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Kamera boshqa dastur tomonidan band qilingan.';
      }
      setModalCameraError(msg);
      setModalCameraActive(false);
    }
  }, [stopModalCamera, attachStreamToVideo]);

  const captureModalPhoto = async () => {
    const video = modalVideoRef.current;
    if (!video) return;
    try {
      setIsExtractingFace(true);
      const canvas = document.createElement('canvas');
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const size = Math.min(vw, vh);
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
        setFormData(prev => ({ ...prev, photo_url: dataUrl }));

        try {
          const det = await detectFace(canvas);
          const desc = await extractFaceDescriptor(canvas, det.box);
          if (desc && desc.length === 128) {
            setExtractedDescriptor(desc);
          }
        } catch (e) {
          console.warn('Biometric extraction error from canvas:', e);
        }

        stopModalCamera();
      }
    } catch (err: any) {
      alert('Suratga olishda xatolik: ' + err.message);
    } finally {
      setIsExtractingFace(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [stuRes, grpRes] = await Promise.all([
        api.getStudents(),
        api.getGroups()
      ]);

      // Sort groups numerically: 1.1, 1.2, ..., 1.9, 2.1, ..., 2.10
      const sortedGroups = [...grpRes].sort((a, b) => {
        const [aMaj, aMin] = a.name.split('.').map(Number);
        const [bMaj, bMin] = b.name.split('.').map(Number);
        if (!isNaN(aMaj) && !isNaN(bMaj) && !isNaN(aMin) && !isNaN(bMin)) {
          if (aMaj !== bMaj) return aMaj - bMaj;
          return aMin - bMin;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

      setStudents(stuRes);
      setGroups(sortedGroups);
      if (sortedGroups.length > 0 && !formData.group_id) {
        setFormData(prev => ({ ...prev, group_id: sortedGroups[0].id }));
      }
    } catch (err) {
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter students
  const filteredStudents = students.filter(st => {
    if (selectedGroup && st.group_id !== selectedGroup) return false;
    if (selectedFaceStatus === 'registered' && !st.is_face_registered) return false;
    if (selectedFaceStatus === 'unregistered' && st.is_face_registered) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${st.first_name} ${st.last_name} ${st.patronymic || ''}`.toLowerCase().includes(q);
      const matchId = st.student_id.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async ev => {
        const dataUrl = ev.target?.result as string;
        setFormData(prev => ({ ...prev, photo_url: dataUrl }));
        setIsExtractingFace(true);
        try {
          const desc = await extractDescriptorFromImageUrl(dataUrl);
          if (desc && desc.length === 128) {
            setExtractedDescriptor(desc);
          }
        } catch (err) {
          console.warn('Failed to extract face descriptor from file:', err);
        } finally {
          setIsExtractingFace(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Open Add Modal
  const openAddModal = () => {
    stopModalCamera();
    setPhotoMode('file');
    setFormError(null);
    setIsSaving(false);
    setExtractedDescriptor(null);
    const nextNum = 1001 + students.length;
    setFormData({
      student_id: `L-${nextNum}`,
      first_name: '',
      last_name: '',
      patronymic: '',
      group_id: groups.length > 0 ? groups[0].id : '',
      photo_url: ''
    });
    setEditingStudent(null);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (student: Student) => {
    stopModalCamera();
    setPhotoMode('file');
    setFormError(null);
    setIsSaving(false);
    setEditingStudent(student);
    setExtractedDescriptor(student.face_descriptor || null);
    setFormData({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      patronymic: student.patronymic || '',
      group_id: student.group_id,
      photo_url: student.photo_url || ''
    });
    setShowAddModal(true);
  };

  // Save student (create or update)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const fName = formData.first_name.trim();
    const lName = formData.last_name.trim();

    if (!fName || !lName) {
      setFormError('Iltimos, o‘quvchining familiyasi va ismini kiriting.');
      return;
    }

    const effectiveGroupId = formData.group_id || (groups.length > 0 ? groups[0].id : 'grp-1-1');
    const effectiveStudentId = formData.student_id.trim() || `L-${1001 + students.length}`;

    setIsSaving(true);
    let finalDescriptor = extractedDescriptor;

    // If student has a photo but descriptor hasn't been extracted yet, extract now
    if (!finalDescriptor && formData.photo_url) {
      try {
        finalDescriptor = await extractDescriptorFromImageUrl(formData.photo_url);
      } catch (err) {
        console.warn('On-save descriptor extraction error:', err);
      }
    }

    const payload = {
      ...formData,
      first_name: fName,
      last_name: lName,
      patronymic: formData.patronymic?.trim() || '',
      student_id: effectiveStudentId,
      group_id: effectiveGroupId,
      face_descriptor: finalDescriptor || (editingStudent?.face_descriptor ?? undefined),
      is_face_registered: finalDescriptor || editingStudent?.is_face_registered ? 1 : 0
    };

    try {
      if (editingStudent) {
        const res = await api.updateStudent(editingStudent.id, payload);
        if (res.success) {
          stopModalCamera();
          setShowAddModal(false);
          await loadData();
        } else {
          setFormError(res.error || 'O‘quvchini yangilashda xatolik yuz berdi');
          setIsSaving(false);
        }
      } else {
        const res = await api.createStudent(payload);
        if (res.success) {
          stopModalCamera();
          setShowAddModal(false);
          await loadData();
        } else {
          setFormError(res.error || 'O‘quvchini qo‘shishda xatolik yuz berdi');
          setIsSaving(false);
        }
      }
    } catch (err: any) {
      setFormError('Tarmoq xatosi: ' + err.message);
      setIsSaving(false);
    }
  };

  // Delete student permanently
  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`"${student.last_name} ${student.first_name}" ni ro‘yxatdan va bazadan butunlay o‘chirib tashlamoqchimisiz?`)) {
      return;
    }
    try {
      const res = await api.deleteStudent(student.id);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'O‘chirishda xatolik yuz berdi');
      }
    } catch (err: any) {
      alert('Xatolik: ' + err.message);
    }
  };

  // Clear all students
  const handleClearAllStudents = async () => {
    if (students.length === 0) return;
    const isConfirmed = confirm(
      `DIQQAT!\nBarcha ${students.length} nafar o‘quvchi va ularning davomat tarixi butunlay tozalanadi.\n\nDavom ettirilsinmi?`
    );
    if (!isConfirmed) return;

    try {
      setLoading(true);
      const res = await api.clearAllStudents();
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Tozalashda xatolik');
      }
    } catch (err: any) {
      alert('Xatolik: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Face Biometric Data
  const handleDeleteFaceData = async (student: Student) => {
    if (!confirm(`${student.first_name} ${student.last_name} ning Face ID biometrik shablonini o‘chirishni xohlaysizmi?`)) {
      return;
    }
    try {
      await api.deleteFace(student.id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            O‘quvchilar ro‘yxati
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Akademik litsey o‘quvchilarini boshqarish va Face ID biometrik yuz shablonlarini ro‘yxatdan o‘tkazish
          </p>
        </div>

        <div className="flex items-center gap-2">
          {students.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllStudents}
              className="py-2.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all flex items-center gap-1.5"
              title="Barcha o‘quvchilarni o‘chirish"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hammasini tozalash</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Yangi o‘quvchi qo‘shish</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Ism, familiya yoki ID bo‘yicha qidirish..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Group Filter */}
        <div className="w-48">
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Barcha guruhlar</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Face Status Filter */}
        <div className="w-48">
          <select
            value={selectedFaceStatus}
            onChange={e => setSelectedFaceStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Face ID: Barchasi</option>
            <option value="registered">Ro‘yxatdan o‘tgan</option>
            <option value="unregistered">Ro‘yxatdan o‘tmagan</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          title="Yangilash"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Students Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs px-4">
            <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
            <p className="font-semibold text-slate-700 text-sm">
              {students.length === 0
                ? 'Hozircha tizimda o‘quvchilar yo‘q'
                : 'Qidiruv bo‘yicha o‘quvchi topilmadi'}
            </p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              {students.length === 0
                ? 'Barcha o‘quvchilarni o‘zingiz ro‘yxatdan o‘tkazishingiz mumkin. Boshlash uchun quyidagi tugmani bosing.'
                : 'Filtr parametrlarini tozalang yoki boshqa so‘z bilan qidiring.'}
            </p>
            {students.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Birinchi o‘quvchini qo‘shish</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-6">O‘quvchi</th>
                  <th className="py-3 px-4">Litsey ID</th>
                  <th className="py-3 px-4">Guruh</th>
                  <th className="py-3 px-4">Face ID holati</th>
                  <th className="py-3 px-4">Faollik</th>
                  <th className="py-3 px-6 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Photo & Name */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600 text-xs">
                          {student.photo_url ? (
                            <img
                              src={student.photo_url}
                              alt={student.first_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            `${student.first_name[0]}${student.last_name[0]}`
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {student.last_name} {student.first_name}
                          </p>
                          {student.patronymic && (
                            <p className="text-[11px] text-slate-400">{student.patronymic}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 tabular-nums">
                      {student.student_id}
                    </td>

                    {/* Group */}
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {student.group_name || 'Guruhsiz'}
                    </td>

                    {/* Face ID Status */}
                    <td className="py-3 px-4">
                      {student.is_face_registered ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          Ro‘yxatdan o‘tgan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          Ro‘yxatdan o‘tmagan
                        </span>
                      )}
                    </td>

                    {/* Active */}
                    <td className="py-3 px-4">
                      {student.is_active ? (
                        <span className="text-slate-600">Faol</span>
                      ) : (
                        <span className="text-slate-400">Arxivlangan</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFaceEnrollingStudent(student)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Yuzni ro‘yxatdan o‘tkazish (Kamera)"
                        >
                          <Camera className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {student.is_face_registered ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteFaceData(student)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Yuz shablonini o‘chirish"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="O‘quvchini butunlay o‘chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingStudent ? 'O‘quvchini tahrirlash' : 'Yangi o‘quvchi qo‘shish'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{formError}</div>
                </div>
              )}

              {/* ID & Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Litsey ID raqami
                  </label>
                  <input
                    type="text"
                    value={formData.student_id}
                    onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                    placeholder="Masalan: L-1001"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Bo‘sh qolsa avtomatik beriladi</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Guruh *
                  </label>
                  <select
                    value={formData.group_id || (groups[0]?.id || '')}
                    onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} — {g.description || `${g.name}-guruh`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Names */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Familiya *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Familiyani kiriting"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Ism *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ismni kiriting"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Otasining ismi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={formData.patronymic}
                  onChange={e => setFormData({ ...formData, patronymic: e.target.value })}
                  placeholder="Otasining ismi"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Profile Photo: Dual Mode (File Upload or Camera Capture) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                    O‘quvchi rasmi
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Fayl yuklash yoki kameradan suratga olish
                  </span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoMode('file');
                      stopModalCamera();
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      photoMode === 'file'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Fayldan yuklash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoMode('camera');
                      startModalCamera();
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      photoMode === 'camera'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    Kameradan olish
                  </button>
                </div>

                {/* Mode A: File Upload */}
                {photoMode === 'file' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {formData.photo_url ? (
                          <img
                            src={formData.photo_url}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-1.5 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            {formData.photo_url ? 'Boshqa fayl tanlash' : 'Kompyuterdan rasm tanlash'}
                          </button>

                          {formData.photo_url && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Rasmni o‘chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          JPG, PNG yoki WEBP formatidagi tiniq yuz tasviri
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode B: Live Camera Capture */}
                {photoMode === 'camera' && (
                  <div className="p-3 bg-slate-900 rounded-xl space-y-3 text-white">
                    {modalCameraError ? (
                      <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-200">
                        <p className="font-semibold mb-1">Kamera xatosi:</p>
                        <p className="text-[11px] mb-2">{modalCameraError}</p>
                        <button
                          type="button"
                          onClick={startModalCamera}
                          className="px-3 py-1 bg-rose-600 text-white rounded text-xs"
                        >
                          Qayta urinish
                        </button>
                      </div>
                    ) : modalCameraActive ? (
                      <div className="space-y-2">
                        <div className="relative aspect-square max-h-56 mx-auto rounded-lg overflow-hidden bg-black border border-slate-700">
                          <video
                            ref={el => {
                              modalVideoRef.current = el;
                              if (el && modalStreamRef.current && el.srcObject !== modalStreamRef.current) {
                                el.srcObject = modalStreamRef.current;
                                el.play().catch(() => {});
                              }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover transform -scale-x-100"
                          />
                          <div className="absolute inset-0 border-2 border-dashed border-emerald-400/60 pointer-events-none rounded-lg m-3" />
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={stopModalCamera}
                            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                          >
                            Kamerani yopish
                          </button>
                          <button
                            type="button"
                            onClick={captureModalPhoto}
                            className="py-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transform active:scale-95"
                          >
                            <Camera className="w-4 h-4" />
                            Hozir suratga olish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {formData.photo_url ? (
                              <img
                                src={formData.photo_url}
                                alt="Captured"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-6 h-6 text-slate-500" />
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={startModalCamera}
                              className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {formData.photo_url ? 'Kamera orqali qayta olish' : 'Kamerani yoqish'}
                            </button>
                            <p className="text-[10px] text-slate-400">
                              Vebkamera orqali to‘g‘ridan-to‘g‘ri rasmga tushirish
                            </p>
                          </div>
                        </div>

                        {/* Quick sample portraits helper */}
                        <div className="pt-2 border-t border-slate-800">
                          <p className="text-[10px] text-slate-400 mb-1.5 font-medium">
                            Yoki tayyor namuna rasmlardan tanlang:
                          </p>
                          <div className="flex items-center gap-2">
                            {[
                              { label: 'Azamat', url: '/src/assets/images/student_azamat_1792854937591.jpg' },
                              { label: 'Malika', url: '/src/assets/images/student_malika_1792854937895.jpg' },
                              { label: 'Jasur', url: '/src/assets/images/student_jasur_1792854937823.jpg' }
                            ].map(item => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, photo_url: item.url }));
                                  stopModalCamera();
                                }}
                                className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                              >
                                <img src={item.url} alt="" className="w-4 h-4 rounded-full object-cover" />
                                <span>{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Biometric Status Indicator */}
              {formData.photo_url && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                      Face ID biometriyasi tayyor
                      {isExtractingFace && (
                        <span className="text-[10px] font-normal text-emerald-600 animate-pulse">
                          (tahlil qilinmoqda...)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      O‘quvchi saqlangach, davomat vaqtida kameradan avtomatik taniladi.
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    stopModalCamera();
                    setShowAddModal(false);
                  }}
                  className="py-2.5 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2.5 px-5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saqlanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{editingStudent ? 'O‘zgarishlarni saqlash' : 'O‘quvchini qo‘shish'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Face Enrollment Modal */}
      {faceEnrollingStudent && (
        <FaceRegistrationModal
          student={faceEnrollingStudent}
          onClose={() => setFaceEnrollingStudent(null)}
          onSuccess={() => {
            setFaceEnrollingStudent(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
