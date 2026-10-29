import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Layers,
  ArrowRight,
  Camera,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { api, SystemStats, AttendanceRecord } from '../api/client.ts';

interface DashboardViewProps {
  onNavigateToScanner: () => void;
  onNavigateToStudents: () => void;
  onNavigateToGroups: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToScanner,
  onNavigateToStudents,
  onNavigateToGroups
}) => {
  const [stats, setStats] = useState<SystemStats>({
    total_students: 0,
    present_today: 0,
    late_today: 0,
    excused_today: 0,
    absent_today: 0,
    groups_count: 0,
    attendance_percentage: 0
  });

  const [recentAttendances, setRecentAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.getTodayStats();
      if (res && res.stats) {
        setStats(res.stats);
        setRecentAttendances(res.recent_attendances || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome & Primary CTA Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
            <span>Litsey Face ID Avtomatlashtirilgan Tizimi</span>
            <span>·</span>
            <span>Lokal va Oflayn</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            O‘quvchilar davomatini yuzni tanish orqali tezkor qayd etish
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
            Kamera orqali 128-o‘lchamli biometrik taqqoslash yordamida o‘quvchilarni 0.2 soniyada aniqlang va bugungi davomat yozuvini avtomatik shakllantiring.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-emerald-500/25 transition-all flex items-center gap-2 transform active:scale-95"
            >
              <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              FACE ID ORQALI DAVOMAT
            </button>

            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl backdrop-blur-sm transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>
        </div>

        {/* Subtle decorative background watermark */}
        <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none select-none text-white font-black text-9xl">
          ID
        </div>
      </div>

      {/* KPI Stats Row (Section 4 Requirements) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Students */}
        <div
          onClick={onNavigateToStudents}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Jami o‘quvchilar</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.total_students}
          </div>
          <p className="text-[11px] text-slate-400">Faol ro‘yxatdagi o‘quvchilar</p>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-medium">
            <span>Bugun kelganlar</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
            {stats.present_today}
          </div>
          <p className="text-[11px] text-slate-400">
            {stats.attendance_percentage}% davomat darajasi
          </p>
        </div>

        {/* Absent Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-rose-600 text-xs font-medium">
            <span>Kelmaganlar</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 font-mono tabular-nums">
            {stats.absent_today}
          </div>
          <p className="text-[11px] text-slate-400">Darsda ishtirok etmagan</p>
        </div>

        {/* Late Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-amber-600 text-xs font-medium">
            <span>Kechikkanlar</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
            {stats.late_today}
          </div>
          <p className="text-[11px] text-slate-400">Qo‘ng‘iroqdan so‘ng kelgan</p>
        </div>

        {/* Groups Count */}
        <div
          onClick={onNavigateToGroups}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-indigo-600 text-xs font-medium">
            <span>Guruhlar soni</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-900 font-mono tabular-nums">
            {stats.groups_count}
          </div>
          <p className="text-[11px] text-slate-400">Akademik litsey guruhlari</p>
        </div>
      </div>

      {/* Recent Attendees List (Section 4 Requirements) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Bugun tanilgan oxirgi o‘quvchilar
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Face ID yoki administrator tomonidan qayd qilingan jonli davomat ro‘yxati
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToScanner}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Yuzni skanerlash
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentAttendances.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
            <p className="font-medium text-slate-600">Bugungi davomat hali boshlanmadi</p>
            <p className="text-slate-400 mt-1">
              "Face ID orqali davomat" tugmasini bosib kamerani ishga tushiring.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-6">O‘quvchi</th>
                  <th className="py-3 px-4">Guruh</th>
                  <th className="py-3 px-4">Kelgan vaqti</th>
                  <th className="py-3 px-4">Holati</th>
                  <th className="py-3 px-4">Usul</th>
                  <th className="py-3 px-6 text-right">Aniqlik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAttendances.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Student Info */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-semibold text-slate-600">
                          {record.photo_url ? (
                            <img
                              src={record.photo_url}
                              alt={record.first_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            record.first_name[0]
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {record.first_name} {record.last_name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            ID: {record.student_code}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Group */}
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {record.group_name}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 tabular-nums">
                      {record.check_in_time}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {record.status === 'kelgan' ? (
                        <span className="text-emerald-700 font-medium">Kelgan</span>
                      ) : record.status === 'kechikkan' ? (
                        <span className="text-amber-700 font-medium">Kechikkan</span>
                      ) : record.status === 'sababli' ? (
                        <span className="text-blue-700 font-medium">Sababli</span>
                      ) : (
                        <span className="text-rose-700 font-medium">Kelmagan</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3 px-4 text-slate-500">
                      {record.method === 'face_id' ? (
                        <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          Face ID
                        </span>
                      ) : (
                        <span className="text-slate-600">Qo‘lda</span>
                      )}
                    </td>

                    {/* Match confidence */}
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-600 font-medium">
                      {record.match_confidence ? Math.round(record.match_confidence * 100) : 100}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
