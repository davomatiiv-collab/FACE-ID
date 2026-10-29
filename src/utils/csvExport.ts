/**
 * CSV and Tabular Export for Attendance Reports
 */

export function exportAttendanceToCSV(
  records: Array<{
    date: string;
    check_in_time: string;
    student_code: string;
    first_name: string;
    last_name: string;
    patronymic?: string;
    group_name: string;
    status: string;
    method: string;
    match_confidence?: number;
    note?: string;
  }>,
  fileName = 'litsey_davomat_hisoboti.csv'
): void {
  const headers = [
    'Sana',
    'Vaqt',
    'O‘quvchi ID',
    'Familiya',
    'Ism',
    'Otasining ismi',
    'Guruh',
    'Holati',
    'Usuli',
    'Aniqlik (%)',
    'Izoh'
  ];

  const statusLabel = (st: string) => {
    switch (st) {
      case 'kelgan':
        return 'Kelgan';
      case 'kechikkan':
        return 'Kechikkan';
      case 'sababli':
        return 'Sababli';
      case 'kelmagan':
        return 'Kelmagan';
      default:
        return st;
    }
  };

  const methodLabel = (m: string) => (m === 'face_id' ? 'Face ID' : 'Qo‘lda kiritilgan');

  const rows = records.map(r => [
    `"${r.date}"`,
    `"${r.check_in_time}"`,
    `"${r.student_code}"`,
    `"${r.last_name}"`,
    `"${r.first_name}"`,
    `"${r.patronymic || ''}"`,
    `"${r.group_name}"`,
    `"${statusLabel(r.status)}"`,
    `"${methodLabel(r.method)}"`,
    `"${r.match_confidence ? Math.round(r.match_confidence * 100) : 100}%"`,
    `"${r.note || ''}"`
  ]);

  // UTF-8 BOM so Excel opens Uzbek Latin & Cyrillic characters flawlessly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
