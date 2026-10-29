import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  queryAll,
  queryOne,
  executeRun,
  hashPassword,
  getDatabaseBinary,
  restoreDatabaseBinary
} from './database.ts';

export const apiRouter = Router();

// -------------------------------------------------------------
// 1. STATS & DASHBOARD
// -------------------------------------------------------------
apiRouter.get('/stats/today', (req: Request, res: Response) => {
  try {
    const today = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const totalStudentsRow = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM students WHERE is_active = 1`
    );
    const groupsCountRow = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM groups WHERE is_archived = 0`
    );

    const attendancesToday = queryAll<{
      id: string;
      student_id: string;
      status: string;
      check_in_time: string;
      method: string;
      match_confidence: number;
      first_name: string;
      last_name: string;
      patronymic: string;
      student_code: string;
      photo_url: string;
      group_name: string;
      group_id: string;
    }>(
      `SELECT a.id, a.student_id, a.status, a.check_in_time, a.method, a.match_confidence,
              s.first_name, s.last_name, s.patronymic, s.student_id as student_code, s.photo_url,
              g.name as group_name, g.id as group_id
       FROM attendances a
       JOIN students s ON a.student_id = s.id
       JOIN groups g ON s.group_id = g.id
       WHERE a.date = ?
       ORDER BY a.check_in_time DESC`,
      [today]
    );

    const presentCount = attendancesToday.filter(a => a.status === 'kelgan').length;
    const lateCount = attendancesToday.filter(a => a.status === 'kechikkan').length;
    const excusedCount = attendancesToday.filter(a => a.status === 'sababli').length;
    const markedAbsentCount = attendancesToday.filter(a => a.status === 'kelmagan').length;

    const totalStudents = totalStudentsRow?.count || 0;
    const totalRecorded = attendancesToday.length;
    // Absent includes explicitly marked absent + active students not yet recorded
    const unrecordedCount = Math.max(0, totalStudents - totalRecorded);
    const totalAbsent = markedAbsentCount + unrecordedCount;

    res.json({
      success: true,
      date: today,
      stats: {
        total_students: totalStudents,
        present_today: presentCount,
        late_today: lateCount,
        excused_today: excusedCount,
        absent_today: totalAbsent,
        groups_count: groupsCountRow?.count || 0,
        attendance_percentage: totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0
      },
      recent_attendances: attendancesToday.slice(0, 15)
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 2. STUDENTS MANAGEMENT
// -------------------------------------------------------------
apiRouter.get('/students', (req: Request, res: Response) => {
  try {
    const { group_id, search, face_registered, is_active } = req.query;
    let sql = `
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (group_id) {
      sql += ` AND s.group_id = ?`;
      params.push(group_id);
    }
    if (face_registered !== undefined && face_registered !== '') {
      sql += ` AND s.is_face_registered = ?`;
      params.push(face_registered === '1' || face_registered === 'true' ? 1 : 0);
    }
    if (is_active !== undefined && is_active !== '') {
      sql += ` AND s.is_active = ?`;
      params.push(is_active === '1' || is_active === 'true' ? 1 : 0);
    }
    if (search) {
      sql += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ?)`;
      const queryPattern = `%${search}%`;
      params.push(queryPattern, queryPattern, queryPattern);
    }

    sql += ` ORDER BY s.last_name ASC, s.first_name ASC`;
    const students = queryAll(sql, params);

    // Parse face_descriptor into array if needed or exclude heavy raw array for list view
    const sanitizedStudents = students.map((s: any) => ({
      ...s,
      face_descriptor: s.face_descriptor ? JSON.parse(s.face_descriptor) : null
    }));

    res.json({ success: true, students: sanitizedStudents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/students', (req: Request, res: Response) => {
  try {
    let { student_id, first_name, last_name, patronymic, group_id, photo_url, face_descriptor } = req.body;

    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return res.status(400).json({ success: false, error: 'O‘quvchi ismi va familiyasini kiritish majburiy' });
    }

    // Auto-generate student_id if missing or empty
    if (!student_id || !student_id.trim()) {
      const countRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students');
      const count = countRow?.count || 0;
      student_id = `L-${1001 + count}`;
    }

    // If ID already exists, make it unique
    const existing = queryOne('SELECT id FROM students WHERE student_id = ?', [student_id.trim()]);
    if (existing) {
      student_id = `${student_id.trim()}-${Math.floor(Math.random() * 900) + 100}`;
    }

    // If group_id is missing, default to the first group
    if (!group_id) {
      const firstGroup = queryOne<{ id: string }>('SELECT id FROM groups WHERE is_archived = 0 ORDER BY name ASC LIMIT 1');
      if (firstGroup) {
        group_id = firstGroup.id;
      } else {
        group_id = 'grp-1-1';
      }
    }

    const id = `stu-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const descriptorJson = face_descriptor && Array.isArray(face_descriptor) && face_descriptor.length > 0
      ? JSON.stringify(face_descriptor)
      : null;
    const isFaceRegistered = descriptorJson ? 1 : 0;

    executeRun(
      `INSERT INTO students (id, student_id, first_name, last_name, patronymic, group_id, photo_url, face_descriptor, is_face_registered, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, student_id.trim(), first_name.trim(), last_name.trim(), patronymic?.trim() || '', group_id, photo_url || '', descriptorJson, isFaceRegistered, now, now]
    );

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'student_create', `Yangi o‘quvchi qo‘shildi: ${first_name} ${last_name} (${student_id})`, 'admin', now]
    );

    res.json({ success: true, student_id: id, message: 'O‘quvchi muvaffaqiyatli qo‘shildi' });
  } catch (error: any) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.put('/students/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      student_id,
      first_name,
      last_name,
      patronymic,
      group_id,
      photo_url,
      face_descriptor,
      is_face_registered,
      is_active
    } = req.body;
    const now = new Date().toISOString();

    const current = queryOne<any>('SELECT * FROM students WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'O‘quvchi topilmadi' });
    }

    let descriptorJson = current.face_descriptor;
    let faceRegistered = current.is_face_registered;

    if (face_descriptor !== undefined) {
      if (Array.isArray(face_descriptor) && face_descriptor.length === 128) {
        descriptorJson = JSON.stringify(face_descriptor);
        faceRegistered = 1;
      } else if (face_descriptor === null) {
        descriptorJson = null;
        faceRegistered = 0;
      }
    } else if (is_face_registered !== undefined) {
      faceRegistered = is_face_registered ? 1 : 0;
    }

    executeRun(
      `UPDATE students
       SET student_id = ?, first_name = ?, last_name = ?, patronymic = ?, group_id = ?, photo_url = ?,
           face_descriptor = ?, is_face_registered = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        student_id || current.student_id,
        first_name || current.first_name,
        last_name || current.last_name,
        patronymic !== undefined ? patronymic : current.patronymic,
        group_id || current.group_id,
        photo_url !== undefined ? photo_url : current.photo_url,
        descriptorJson,
        faceRegistered,
        is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
        now,
        id
      ]
    );

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'student_update', `O‘quvchi ma’lumotlari yangilandi: ${first_name || current.first_name} ${last_name || current.last_name}`, 'admin', now]
    );

    res.json({ success: true, message: 'O‘quvchi ma’lumotlari yangilandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/students/:id/face', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { face_descriptor, photo_url } = req.body;

    if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length === 0) {
      return res.status(400).json({ success: false, error: 'Yuz shabloni noto‘g‘ri yoki bo‘sh' });
    }

    const current = queryOne('SELECT * FROM students WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'O‘quvchi topilmadi' });
    }

    const now = new Date().toISOString();
    const descriptorJson = JSON.stringify(face_descriptor);
    const photoToSave = photo_url || current.photo_url;

    executeRun(
      `UPDATE students
       SET face_descriptor = ?, is_face_registered = 1, photo_url = ?, updated_at = ?
       WHERE id = ?`,
      [descriptorJson, photoToSave, now, id]
    );

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'face_registered', `Face ID ro‘yxatdan o‘tkazildi: ${current.first_name} ${current.last_name} (${current.student_id})`, 'admin', now]
    );

    res.json({
      success: true,
      message: 'Yuz shabloni muvaffaqiyatli ro‘yxatdan o‘tkazildi va bazaga saqlandi'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.delete('/students/:id/face', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const current = queryOne('SELECT * FROM students WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'O‘quvchi topilmadi' });
    }

    const now = new Date().toISOString();
    executeRun(
      `UPDATE students SET face_descriptor = NULL, is_face_registered = 0, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'face_deleted', `Face ID shabloni o‘chirildi: ${current.first_name} ${current.last_name}`, 'admin', now]
    );

    res.json({ success: true, message: 'Yuz shabloni muvaffaqiyatli o‘chirildi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.delete('/students/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const current = queryOne('SELECT * FROM students WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'O‘quvchi topilmadi' });
    }
    const now = new Date().toISOString();
    executeRun('DELETE FROM attendances WHERE student_id = ?', [id]);
    executeRun('DELETE FROM students WHERE id = ?', [id]);
    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'student_delete', `O‘quvchi butunlay o‘chirildi: ${current.first_name} ${current.last_name} (${current.student_id})`, 'admin', now]
    );
    res.json({ success: true, message: 'O‘quvchi muvaffaqiyatli o‘chirildi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/students/clear-all', (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    executeRun('DELETE FROM attendances');
    executeRun('DELETE FROM students');
    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'students_cleared', 'Barcha o‘quvchilar ro‘yxati tozalab tashlandi', 'admin', now]
    );
    res.json({ success: true, message: 'Barcha o‘quvchilar muvaffaqiyatli tozalandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 3. GROUPS MANAGEMENT
// -------------------------------------------------------------
apiRouter.get('/groups', (req: Request, res: Response) => {
  try {
    const today = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const groups = queryAll<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      is_archived: number;
    }>(`SELECT * FROM groups WHERE is_archived = 0 ORDER BY name ASC`);

    const result = groups.map(g => {
      const studentCount = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM students WHERE group_id = ? AND is_active = 1`,
        [g.id]
      )?.count || 0;

      const presentCount = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM attendances a
         JOIN students s ON a.student_id = s.id
         WHERE s.group_id = ? AND a.date = ? AND a.status IN ('kelgan', 'kechikkan')`,
        [g.id, today]
      )?.count || 0;

      return {
        ...g,
        total_students: studentCount,
        present_today: presentCount,
        absent_today: Math.max(0, studentCount - presentCount)
      };
    });

    res.json({ success: true, groups: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/groups', (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Guruh nomi kiritilishi shart' });
    }

    const existing = queryOne('SELECT id FROM groups WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ushbu nomdagi guruh allaqachon mavjud' });
    }

    const id = `grp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    executeRun(
      `INSERT INTO groups (id, name, description, created_at, is_archived) VALUES (?, ?, ?, ?, 0)`,
      [id, name.trim(), description?.trim() || '', now]
    );

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'group_create', `Yangi guruh ochildi: ${name.trim()}`, 'admin', now]
    );

    res.json({ success: true, group_id: id, message: 'Guruh muvaffaqiyatli yaratildi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.put('/groups/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    executeRun(
      `UPDATE groups SET name = ?, description = ? WHERE id = ?`,
      [name.trim(), description?.trim() || '', id]
    );

    res.json({ success: true, message: 'Guruh ma’lumotlari yangilandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.delete('/groups/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    executeRun(`UPDATE groups SET is_archived = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Guruh arxivlandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/groups/transfer-student', (req: Request, res: Response) => {
  try {
    const { student_id, new_group_id } = req.body;
    if (!student_id || !new_group_id) {
      return res.status(400).json({ success: false, error: 'Talaba va yangi guruh tanlanishi shart' });
    }

    const now = new Date().toISOString();
    executeRun(`UPDATE students SET group_id = ?, updated_at = ? WHERE id = ?`, [new_group_id, now, student_id]);

    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'student_transfer', `O‘quvchi boshqa guruhga ko‘chirildi`, 'admin', now]
    );

    res.json({ success: true, message: 'O‘quvchi yangi guruhga muvaffaqiyatli o‘tkazildi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 4. ATTENDANCE & FACE ID CHECK-IN
// -------------------------------------------------------------
apiRouter.get('/attendance', (req: Request, res: Response) => {
  try {
    const { date, start_date, end_date, group_id, student_id, status } = req.query;
    let sql = `
      SELECT a.*, s.first_name, s.last_name, s.patronymic, s.student_id as student_code, s.photo_url,
             g.name as group_name, g.id as group_id
      FROM attendances a
      JOIN students s ON a.student_id = s.id
      JOIN groups g ON s.group_id = g.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      sql += ` AND a.date = ?`;
      params.push(date);
    } else if (start_date && end_date) {
      sql += ` AND a.date >= ? AND a.date <= ?`;
      params.push(start_date, end_date);
    }

    if (group_id) {
      sql += ` AND s.group_id = ?`;
      params.push(group_id);
    }
    if (student_id) {
      sql += ` AND a.student_id = ?`;
      params.push(student_id);
    }
    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY a.date DESC, a.check_in_time DESC`;
    const records = queryAll(sql, params);

    res.json({ success: true, records });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/attendance/check-in', (req: Request, res: Response) => {
  try {
    const { student_id, method, match_confidence, date, time, note } = req.body;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'O‘quvchi ID raqami kerak' });
    }

    const student = queryOne<{
      id: string;
      student_id: string;
      first_name: string;
      last_name: string;
      patronymic: string;
      group_id: string;
      photo_url: string;
      group_name: string;
    }>(
      `SELECT s.*, g.name as group_name
       FROM students s
       JOIN groups g ON s.group_id = g.id
       WHERE s.id = ? OR s.student_id = ?`,
      [student_id, student_id]
    );

    if (!student) {
      return res.status(404).json({ success: false, error: 'O‘quvchi bazadan topilmadi' });
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const nowTime = time || new Date().toTimeString().split(' ')[0]; // HH:mm:ss

    // Check if already checked in today!
    const existing = queryOne<{
      id: string;
      date: string;
      check_in_time: string;
      status: string;
      method: string;
    }>(
      `SELECT * FROM attendances WHERE student_id = ? AND date = ?`,
      [student.id, todayDate]
    );

    if (existing) {
      return res.json({
        success: true,
        already_recorded: true,
        message: 'Davomat avval belgilangan',
        record: existing,
        student
      });
    }

    // Determine status based on settings (start_time + late_threshold_minutes)
    const settings = queryOne<any>('SELECT * FROM settings WHERE id = ?', ['default']);
    const startTimeStr = settings?.start_time || '08:30';
    const lateThresholdMinutes = Number(settings?.late_threshold_minutes) || 15;

    let computedStatus = 'kelgan';
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [currH, currM] = nowTime.split(':').map(Number);

    const startTotalMin = startH * 60 + startM + lateThresholdMinutes;
    const currTotalMin = currH * 60 + currM;

    if (currTotalMin > startTotalMin) {
      computedStatus = 'kechikkan';
    }

    const attendanceId = `att-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const conf = typeof match_confidence === 'number' ? match_confidence : 1.0;
    const markMethod = method || 'face_id';
    const recordedBy = markMethod === 'face_id' ? 'Face ID Tizimi' : 'Administrator';

    executeRun(
      `INSERT INTO attendances (id, student_id, date, check_in_time, status, method, match_confidence, note, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attendanceId,
        student.id,
        todayDate,
        nowTime,
        computedStatus,
        markMethod,
        conf,
        note || (computedStatus === 'kechikkan' ? 'Darsga kechikib keldi' : 'Muntazam keldi'),
        recordedBy,
        now
      ]
    );

    res.json({
      success: true,
      already_recorded: false,
      message: 'Davomat belgilandi',
      status: computedStatus,
      student,
      record: {
        id: attendanceId,
        date: todayDate,
        check_in_time: nowTime,
        status: computedStatus,
        method: markMethod,
        match_confidence: conf
      }
    });
  } catch (error: any) {
    console.error('Error during attendance check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.put('/attendance/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note, reason } = req.body;

    const current = queryOne<{ student_id: string; status: string; date: string }>(
      'SELECT * FROM attendances WHERE id = ?',
      [id]
    );
    if (!current) {
      return res.status(404).json({ success: false, error: 'Davomat yozuvi topilmadi' });
    }

    const noteToSave = reason ? `Qo‘lda o‘zgartirildi: ${reason}` : (note || current.status);

    executeRun(
      `UPDATE attendances SET status = ?, note = ?, method = 'manual', recorded_by = 'Administrator' WHERE id = ?`,
      [status, noteToSave, id]
    );

    const now = new Date().toISOString();
    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'attendance_manual_edit', `Davomat holati o‘zgartirildi (${current.status} -> ${status}). Sabab: ${reason || 'Sabab ko‘rsatilmadi'}`, 'admin', now]
    );

    res.json({ success: true, message: 'Davomat yozuvi muvaffaqiyatli yangilandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual bulk check-in / mark remaining as absent
apiRouter.post('/attendance/mark-remaining-absent', (req: Request, res: Response) => {
  try {
    const { date, group_id } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let studentsSql = `SELECT id, first_name, last_name FROM students WHERE is_active = 1`;
    const params: any[] = [];
    if (group_id) {
      studentsSql += ` AND group_id = ?`;
      params.push(group_id);
    }

    const activeStudents = queryAll<{ id: string; first_name: string; last_name: string }>(studentsSql, params);
    let markedCount = 0;
    const now = new Date().toISOString();

    for (const student of activeStudents) {
      const existing = queryOne('SELECT id FROM attendances WHERE student_id = ? AND date = ?', [student.id, targetDate]);
      if (!existing) {
        const id = `att-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        executeRun(
          `INSERT INTO attendances (id, student_id, date, check_in_time, status, method, match_confidence, note, recorded_by, created_at)
           VALUES (?, ?, ?, '00:00:00', 'kelmagan', 'manual', 1.0, 'Darsga kelmagan deb qayd etildi', 'Administrator', ?)`,
          [id, student.id, targetDate, now]
        );
        markedCount++;
      }
    }

    res.json({ success: true, marked_count: markedCount, message: `${markedCount} nafar o‘quvchiga 'kelmagan' holati belgilandi` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 5. REPORTS & EXPORT
// -------------------------------------------------------------
apiRouter.get('/reports/summary', (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.query;
    const numDays = Number(days) || 7;

    const daySummaries: any[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const rows = queryAll<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM attendances WHERE date = ? GROUP BY status`,
        [dateStr]
      );

      const statusMap: Record<string, number> = { kelgan: 0, kechikkan: 0, sababli: 0, kelmagan: 0 };
      rows.forEach(r => {
        statusMap[r.status] = r.count;
      });

      daySummaries.push({
        date: dateStr,
        day_name: d.toLocaleDateString('uz-UZ', { weekday: 'short' }),
        ...statusMap
      });
    }

    // Group breakdown
    const groupStats = queryAll<{ id: string; name: string }>(
      `SELECT id, name FROM groups WHERE is_archived = 0`
    ).map(grp => {
      const totalInGroup = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM students WHERE group_id = ? AND is_active = 1`,
        [grp.id]
      )?.count || 0;

      const presentRecent = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM attendances a
         JOIN students s ON a.student_id = s.id
         WHERE s.group_id = ? AND a.status IN ('kelgan', 'kechikkan')`,
        [grp.id]
      )?.count || 0;

      return {
        group_id: grp.id,
        group_name: grp.name,
        total_students: totalInGroup,
        total_present_records: presentRecent
      };
    });

    res.json({
      success: true,
      day_summaries: daySummaries,
      group_stats: groupStats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 6. SETTINGS & AUTH
// -------------------------------------------------------------
apiRouter.get('/settings', (_req: Request, res: Response) => {
  try {
    const settings = queryOne('SELECT * FROM settings WHERE id = ?', ['default']);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.put('/settings', (req: Request, res: Response) => {
  try {
    const {
      school_name,
      start_time,
      late_threshold_minutes,
      face_match_threshold,
      require_manual_confirm_on_low_confidence,
      enable_liveness_check,
      camera_device_id
    } = req.body;

    executeRun(
      `UPDATE settings
       SET school_name = ?, start_time = ?, late_threshold_minutes = ?,
           face_match_threshold = ?, require_manual_confirm_on_low_confidence = ?,
           enable_liveness_check = ?, camera_device_id = ?
       WHERE id = 'default'`,
      [
        school_name,
        start_time,
        Number(late_threshold_minutes),
        Number(face_match_threshold),
        require_manual_confirm_on_low_confidence ? 1 : 0,
        enable_liveness_check ? 1 : 0,
        camera_device_id || ''
      ]
    );

    const now = new Date().toISOString();
    executeRun(
      `INSERT INTO audit_logs (id, action, details, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`log-${Date.now()}`, 'settings_update', 'Tizim sozlamalari yangilandi', 'admin', now]
    );

    res.json({ success: true, message: 'Sozlamalar saqlandi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Login va parol kiritilishi kerak' });
    }

    const admin = queryOne<{
      id: string;
      username: string;
      password_hash: string;
      salt: string;
      full_name: string;
      role: string;
    }>('SELECT * FROM admins WHERE username = ?', [username.trim()]);

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Login yoki parol noto‘g‘ri' });
    }

    const testHash = hashPassword(password, admin.salt);
    if (testHash.hash !== admin.password_hash) {
      return res.status(401).json({ success: false, error: 'Login yoki parol noto‘g‘ri' });
    }

    // Return user info
    res.json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role
      },
      token: `tok-${admin.id}-${Date.now()}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/auth/change-password', (req: Request, res: Response) => {
  try {
    const { username, current_password, new_password } = req.body;
    const admin = queryOne<{ id: string; password_hash: string; salt: string }>(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    if (!admin) return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });

    const test = hashPassword(current_password, admin.salt);
    if (test.hash !== admin.password_hash) {
      return res.status(400).json({ success: false, error: 'Joriy parol noto‘g‘ri' });
    }

    const newHashed = hashPassword(new_password);
    executeRun(
      `UPDATE admins SET password_hash = ?, salt = ? WHERE username = ?`,
      [newHashed.hash, newHashed.salt, username]
    );

    res.json({ success: true, message: 'Parol muvaffaqiyatli o‘zgartirildi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 7. AUDIT LOGS & BACKUP/RESTORE
// -------------------------------------------------------------
apiRouter.get('/audit-logs', (_req: Request, res: Response) => {
  try {
    const logs = queryAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/backup/download', (_req: Request, res: Response) => {
  try {
    const binary = getDatabaseBinary();
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="litsey_faceid_backup_${new Date().toISOString().split('T')[0]}.sqlite"`);
    res.send(Buffer.from(binary));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/backup/json', (_req: Request, res: Response) => {
  try {
    const students = queryAll('SELECT * FROM students');
    const groups = queryAll('SELECT * FROM groups');
    const attendances = queryAll('SELECT * FROM attendances');
    const settings = queryAll('SELECT * FROM settings');

    res.json({
      success: true,
      exported_at: new Date().toISOString(),
      data: {
        groups,
        students,
        attendances,
        settings
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/backup/restore', async (req: Request, res: Response) => {
  try {
    const { base64Data, jsonData } = req.body;

    if (base64Data) {
      const buffer = Buffer.from(base64Data, 'base64');
      await restoreDatabaseBinary(new Uint8Array(buffer));
      return res.json({ success: true, message: 'SQLite ma’lumotlar bazasi zaxira nusxadan muvaffaqiyatli tiklandi' });
    }

    if (jsonData && jsonData.students && jsonData.groups) {
      // Re-insert records
      for (const g of jsonData.groups) {
        executeRun(`INSERT OR REPLACE INTO groups (id, name, description, created_at, is_archived) VALUES (?, ?, ?, ?, ?)`,
          [g.id, g.name, g.description, g.created_at, g.is_archived || 0]);
      }
      for (const s of jsonData.students) {
        executeRun(`INSERT OR REPLACE INTO students (id, student_id, first_name, last_name, patronymic, group_id, photo_url, face_descriptor, is_face_registered, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.student_id, s.first_name, s.last_name, s.patronymic, s.group_id, s.photo_url, s.face_descriptor, s.is_face_registered, s.is_active, s.created_at, s.updated_at]);
      }
      if (jsonData.attendances) {
        for (const a of jsonData.attendances) {
          executeRun(`INSERT OR REPLACE INTO attendances (id, student_id, date, check_in_time, status, method, match_confidence, note, recorded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [a.id, a.student_id, a.date, a.check_in_time, a.status, a.method, a.match_confidence, a.note, a.recorded_by, a.created_at]);
        }
      }
      return res.json({ success: true, message: 'JSON ma’lumotlar nusxasi tiklandi' });
    }

    res.status(400).json({ success: false, error: 'Zaxira fayli formati noto‘g‘ri' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
