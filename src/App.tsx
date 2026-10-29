import React, { useState, useEffect } from 'react';
import {
  Home,
  Camera,
  Users,
  Layers,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  Menu,
  X,
  Play,
  HardDrive
} from 'lucide-react';
import { DashboardView } from './components/DashboardView.tsx';
import { AttendanceScannerView } from './components/AttendanceScannerView.tsx';
import { StudentsView } from './components/StudentsView.tsx';
import { GroupsView } from './components/GroupsView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

type NavSection =
  | 'dashboard'
  | 'attendance'
  | 'students'
  | 'groups'
  | 'history'
  | 'reports'
  | 'settings';

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Authenticated Admin User (seeded with default superadmin)
  const [adminUser, setAdminUser] = useState<{
    id: string;
    username: string;
    full_name: string;
    role: string;
  } | null>({
    id: 'adm-1',
    username: 'admin',
    full_name: 'Bosh Administrator',
    role: 'superadmin'
  });

  const navItems = [
    { id: 'dashboard' as NavSection, label: 'Bosh sahifa', icon: Home },
    { id: 'attendance' as NavSection, label: 'Davomat (Face ID)', icon: Camera, highlight: true },
    { id: 'students' as NavSection, label: 'O‘quvchilar', icon: Users },
    { id: 'groups' as NavSection, label: 'Guruhlar', icon: Layers },
    { id: 'history' as NavSection, label: 'Davomat tarixi', icon: History },
    { id: 'reports' as NavSection, label: 'Hisobotlar', icon: BarChart3 },
    { id: 'settings' as NavSection, label: 'Administrator', icon: Settings },
  ];

  const getSectionTitle = (id: NavSection): string => {
    switch (id) {
      case 'dashboard':
        return 'Boshqaruv paneli';
      case 'attendance':
        return 'Face ID Davomat';
      case 'students':
        return 'O‘quvchilar bazasi';
      case 'groups':
        return 'Litsey guruhlari';
      case 'history':
        return 'Davomat jurnali va tarixi';
      case 'reports':
        return 'Tahliliy hisobotlar';
      case 'settings':
        return 'Administrator va tizim sozlamalari';
      default:
        return 'Bosh sahifa';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Top Header */}
      <div className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0">
            <img
              src="/src/assets/images/lyceum_crest_1792854935381.jpg"
              alt="Crest"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-bold text-sm tracking-tight">LITSEY FACE ID</span>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 text-slate-300 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Left Sidebar (260px desktop width) */}
      <aside
        className={`fixed lg:sticky top-0 h-screen w-64 bg-slate-900 text-slate-200 border-r border-slate-800 z-50 flex flex-col justify-between transition-transform duration-200 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Lyceum Brand Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shadow-sm shrink-0">
              <img
                src="/src/assets/images/lyceum_crest_1792854935381.jpg"
                alt="Emblem"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight">
                LITSEY FACE ID
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Akademik Litsey Tizimi
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            type="button"
            onClick={() => {
              setCurrentSection('attendance');
              setIsMobileMenuOpen(false);
            }}
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Camera className="w-4 h-4 fill-white" />
            Face ID Davomat
          </button>

          {/* 7 Menu Items */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentSection(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-300 font-medium">Lokal SQLite Bazasi</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            100% Oflayn va maxfiy. Internet aloqasi talab qilinmaydi.
          </p>
        </div>
      </aside>

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Single-line row with Breadcrumbs on left, Action on right */}
        <header className="hidden lg:flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Litsey</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">
              {getSectionTitle(currentSection)}
            </span>
          </div>

          {/* Actions & Admin badge */}
          <div className="flex items-center gap-3 shrink-0">
            {currentSection !== 'attendance' && (
              <button
                type="button"
                onClick={() => setCurrentSection('attendance')}
                className="py-1.5 px-3.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Davomatni boshlash
              </button>
            )}

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 text-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-[11px]">
                {adminUser ? adminUser.username[0].toUpperCase() : 'A'}
              </div>
              <span className="font-medium text-slate-700">
                {adminUser ? adminUser.full_name : 'Administrator'}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Section Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentSection === 'dashboard' && (
            <DashboardView
              onNavigateToScanner={() => setCurrentSection('attendance')}
              onNavigateToStudents={() => setCurrentSection('students')}
              onNavigateToGroups={() => setCurrentSection('groups')}
            />
          )}

          {currentSection === 'attendance' && (
            <AttendanceScannerView
              onAttendanceUpdated={() => {
                // Background refresh when check-ins happen
              }}
            />
          )}

          {currentSection === 'students' && <StudentsView />}

          {currentSection === 'groups' && <GroupsView />}

          {currentSection === 'history' && <HistoryView />}

          {currentSection === 'reports' && <ReportsView />}

          {currentSection === 'settings' && (
            <SettingsView
              adminUser={adminUser}
              onLogout={() => setAdminUser(null)}
              onLogin={user => setAdminUser(user)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
