import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserX,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { api, AttendanceRecord } from '../api/client.ts';
import { exportAttendanceToCSV } from '../utils/csvExport.ts';

export const ReportsView: React.FC = () => {
  const [timeframe, setTimeframe] = useState<number>(7); // 7, 14, 30 days
  const [summaryData, setSummaryData] = useState<{ day_summaries: any[]; group_stats: any[] }>({
    day_summaries: [],
    group_stats: []
  });
  const [loading, setLoading] = useState(true);
  const [markingAbsents, setMarkingAbsents] = useState(false);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReportsSummary(timeframe);
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [timeframe]);

  const handleExportFullReport = async () => {
    try {
      const records = await api.getAttendance({});
      exportAttendanceToCSV(
        records.map(r => ({
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
        `litsey_to'liq_davomat_hisoboti_${new Date().toISOString().split('T')[0]}.csv`
      );
    } catch (err: any) {
      alert('Eksport xatosi: ' + err.message);
    }
  };

  const handleMarkAbsentsForToday = async () => {
    if (!confirm('Bugungi darsga kelmagan barcha faol o‘quvchilarga avtomatik "kelmagan" holatini belgilashni xohlaysizmi?')) {
      return;
    }
    setMarkingAbsents(true);
    try {
      const res = await api.markRemainingAbsent();
      if (res.success) {
        alert(res.message);
        loadReports();
      }
    } catch (err: any) {
      alert('Xatolik: ' + err.message);
    } finally {
      setMarkingAbsents(false);
    }
  };

  const maxTotalInDay = Math.max(
    1,
    ...summaryData.day_summaries.map(d => (d.kelgan || 0) + (d.kechikkan || 0) + (d.sababli || 0) + (d.kelmagan || 0))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Davomat hisobotlari va tahlil
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kunlik, haftalik va oylik davomat dinamikasi, guruhlar faolligi va umumiy analitika
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAbsentsForToday}
            disabled={markingAbsents}
            className="py-2.5 px-3.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
            title="Kelmaganlarni avtomatik belgilash"
          >
            <UserX className="w-3.5 h-3.5" />
            {markingAbsents ? 'Belgilanmoqda...' : 'Kelmaganlarni belgilash'}
          </button>

          <button
            type="button"
            onClick={handleExportFullReport}
            className="py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel / CSV to‘liq hisobot
          </button>
        </div>
      </div>

      {/* Timeframe Selector & Overall stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Davomat trendi ({timeframe} kunlik ko‘rsatkich)
            </h3>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTimeframe(7)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 kunlik
            </button>
            <button
              type="button"
              onClick={() => setTimeframe(14)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === 14 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              14 kunlik
            </button>
            <button
              type="button"
              onClick={() => setTimeframe(30)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === 30 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 kunlik
            </button>
          </div>
        </div>

        {/* CSS Bar Chart */}
        <div className="pt-4 pb-2">
          <div className="h-48 flex items-end gap-3 sm:gap-6 border-b border-slate-200 pb-2">
            {summaryData.day_summaries.map(day => {
              const present = day.kelgan || 0;
              const late = day.kechikkan || 0;
              const absent = day.kelmagan || 0;
              const total = present + late + absent;
              const presentHeight = total > 0 ? (present / maxTotalInDay) * 100 : 0;
              const lateHeight = total > 0 ? (late / maxTotalInDay) * 100 : 0;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex flex-col gap-0.5 items-center justify-end h-full">
                    <span className="text-[10px] text-slate-500 font-mono mb-1">
                      {present + late}
                    </span>
                    <div
                      style={{ height: `${Math.max(4, lateHeight)}%` }}
                      className="w-full max-w-[28px] bg-amber-400 rounded-t"
                      title={`Kechikkan: ${late}`}
                    />
                    <div
                      style={{ height: `${Math.max(6, presentHeight)}%` }}
                      className="w-full max-w-[28px] bg-emerald-500 rounded-t"
                      title={`Kelgan: ${present}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium tracking-tight mt-1 truncate max-w-full">
                    {day.day_name}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {day.date.split('-').slice(1).join('/')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 pt-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              Kelganlar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
              Kechikkanlar
            </span>
          </div>
        </div>
      </div>

      {/* Group Attendance Performance */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Guruhlar bo‘yicha umumiy ko‘rsatkich
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Har bir guruhning jami o‘quvchilar soni va qayd qilingan davomat faolligi
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {summaryData.group_stats.map(grp => (
            <div key={grp.group_id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">{grp.group_name}</h4>
                <p className="text-[11px] text-slate-500">
                  Jami ro‘yxatdagi o‘quvchilar: <strong className="text-slate-800 font-mono">{grp.total_students}</strong> nafar
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-indigo-700">
                  {grp.total_present_records} ta
                </span>
                <p className="text-[10px] text-slate-400">umumiy ishtirok yozuvi</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
