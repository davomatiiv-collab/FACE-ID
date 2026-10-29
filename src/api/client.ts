/**
 * Litsey Face ID — Typed API Client
 */

export interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  group_id: string;
  group_name?: string;
  photo_url?: string;
  face_descriptor?: number[] | null;
  is_face_registered: number;
  is_active: number;
  created_at?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  is_archived: number;
  total_students: number;
  present_today: number;
  absent_today: number;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  check_in_time: string;
  status: 'kelgan' | 'kechikkan' | 'sababli' | 'kelmagan';
  method: 'face_id' | 'manual';
  match_confidence: number;
  note?: string;
  recorded_by?: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  student_code: string;
  photo_url?: string;
  group_name: string;
  group_id: string;
}

export interface SystemStats {
  total_students: number;
  present_today: number;
  late_today: number;
  excused_today: number;
  absent_today: number;
  groups_count: number;
  attendance_percentage: number;
}

export interface SystemSettings {
  id: string;
  school_name: string;
  start_time: string;
  late_threshold_minutes: number;
  face_match_threshold: number;
  require_manual_confirm_on_low_confidence: number;
  enable_liveness_check: number;
  camera_device_id?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  user_id: string;
  created_at: string;
}

const API_BASE = '/api';

export const api = {
  // Stats
  async getTodayStats(date?: string): Promise<{ stats: SystemStats; recent_attendances: AttendanceRecord[] }> {
    const url = date ? `${API_BASE}/stats/today?date=${date}` : `${API_BASE}/stats/today`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
  },

  // Students
  async getStudents(params?: { group_id?: string; search?: string; face_registered?: string }): Promise<Student[]> {
    const q = new URLSearchParams();
    if (params?.group_id) q.set('group_id', params.group_id);
    if (params?.search) q.set('search', params.search);
    if (params?.face_registered) q.set('face_registered', params.face_registered);
    const res = await fetch(`${API_BASE}/students?${q.toString()}`);
    const data = await res.json();
    return data.students || [];
  },

  async createStudent(studentData: Partial<Student>): Promise<{ success: boolean; student_id?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    return res.json();
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async registerFace(id: string, faceDescriptor: number[], photoUrl?: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await fetch(`${API_BASE}/students/${id}/face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ face_descriptor: faceDescriptor, photo_url: photoUrl })
    });
    return res.json();
  },

  async deleteFace(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/students/${id}/face`, { method: 'DELETE' });
    return res.json();
  },

  async deleteStudent(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async clearAllStudents(): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/students/clear-all`, { method: 'POST' });
    return res.json();
  },

  // Groups
  async getGroups(date?: string): Promise<Group[]> {
    const url = date ? `${API_BASE}/groups?date=${date}` : `${API_BASE}/groups`;
    const res = await fetch(url);
    const data = await res.json();
    return data.groups || [];
  },

  async createGroup(name: string, description?: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    return res.json();
  },

  async updateGroup(id: string, name: string, description?: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    return res.json();
  },

  async archiveGroup(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/groups/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async transferStudent(student_id: string, new_group_id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/groups/transfer-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id, new_group_id })
    });
    return res.json();
  },

  // Attendance
  async getAttendance(params?: {
    date?: string;
    start_date?: string;
    end_date?: string;
    group_id?: string;
    student_id?: string;
    status?: string;
  }): Promise<AttendanceRecord[]> {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.start_date) q.set('start_date', params.start_date);
    if (params?.end_date) q.set('end_date', params.end_date);
    if (params?.group_id) q.set('group_id', params.group_id);
    if (params?.student_id) q.set('student_id', params.student_id);
    if (params?.status) q.set('status', params.status);

    const res = await fetch(`${API_BASE}/attendance?${q.toString()}`);
    const data = await res.json();
    return data.records || [];
  },

  async checkIn(payload: {
    student_id: string;
    method: 'face_id' | 'manual';
    match_confidence?: number;
    date?: string;
    time?: string;
    note?: string;
  }): Promise<{
    success: boolean;
    already_recorded: boolean;
    message: string;
    status?: string;
    student?: any;
    record?: any;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async updateAttendance(id: string, payload: { status: string; reason?: string; note?: string }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/attendance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async markRemainingAbsent(date?: string, group_id?: string): Promise<{ success: boolean; marked_count?: number; error?: string; message?: string }> {
    const res = await fetch(`${API_BASE}/attendance/mark-remaining-absent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, group_id })
    });
    return res.json();
  },

  // Reports
  async getReportsSummary(days = 7): Promise<{ day_summaries: any[]; group_stats: any[] }> {
    const res = await fetch(`${API_BASE}/reports/summary?days=${days}`);
    return res.json();
  },

  // Settings & Auth
  async getSettings(): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    const data = await res.json();
    return data.settings;
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  async login(username: string, password: string): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  async changePassword(payload: { username: string; current_password: string; new_password: string }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit-logs`);
    const data = await res.json();
    return data.logs || [];
  },

  async restoreBackup(payload: { base64Data?: string; jsonData?: any }): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }
};
