import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  RefreshCw,
  Search,
  UserX,
  Volume2,
  Video,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import {
  detectFace,
  extractFaceDescriptor,
  extractDescriptorFromImageUrl,
  matchLiveFace,
  playSuccessChime,
  playDuplicateChime,
  playUnrecognizedAlert,
  StudentBiometric
} from '../utils/faceRecognition.ts';
import { api, AttendanceRecord, SystemSettings } from '../api/client.ts';

interface AttendanceScannerViewProps {
  onAttendanceUpdated?: () => void;
}

interface TestSubject {
  id: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  student_id: string;
  group_name: string;
  photo_url: string;
  isRegistered: boolean;
  box: { x: number; y: number; width: number; height: number };
}

export const AttendanceScannerView: React.FC<AttendanceScannerViewProps> = ({
  onAttendanceUpdated
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Mode: 'stream' (Talabalar kamera oqimi / Face feed) or 'webcam' (Haqiqiy noutbuk kamerasi)
  const [cameraMode, setCameraMode] = useState<'stream' | 'webcam'>('stream');
  const [isActive, setIsActive] = useState<boolean>(true); // Auto-active on view load
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [registeredStudents, setRegisteredStudents] = useState<StudentBiometric[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [todayPresentCount, setTodayPresentCount] = useState<number>(0);

  // Simulation test subjects (dynamically constructed from registered students + unknown test subject)
  const testSubjects: TestSubject[] = useMemo(() => {
    if (registeredStudents.length > 0) {
      const list: TestSubject[] = registeredStudents.map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        patronymic: s.patronymic,
        student_id: s.student_id,
        group_name: s.group_name || 'Guruh',
        photo_url: s.photo_url || '/src/assets/images/student_azamat_1792854937591.jpg',
        isRegistered: true,
        box: { x: 22, y: 14, width: 56, height: 68 }
      }));

      // Add 1 unregistered visitor to test unrecognized / red box state
      list.push({
        id: 'unknown-1',
        first_name: 'Begona',
        last_name: 'Shaxs',
        student_id: 'NO-ID',
        group_name: 'Bazada yo‘q (Noma’lum)',
        photo_url: '/src/assets/images/unknown_visitor_1792856396669.jpg',
        isRegistered: false,
        box: { x: 21, y: 12, width: 58, height: 70 }
      });

      return list;
    }

    // Default unknown subject when no registered students exist yet
    return [
      {
        id: 'unknown-1',
        first_name: 'Begona',
        last_name: 'Shaxs',
        student_id: 'NO-ID',
        group_name: 'Bazada yo‘q (Noma’lum)',
        photo_url: '/src/assets/images/unknown_visitor_1792856396669.jpg',
        isRegistered: false,
        box: { x: 21, y: 12, width: 58, height: 70 }
      }
    ];
  }, [registeredStudents]);

  const [currentSubjectIndex, setCurrentSubjectIndex] = useState<number>(0);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);

  // Live Screen Bounding Box Status
  // 'recognized' (green), 'duplicate' (yellow), 'unrecognized' (red), 'scanning' (blue)
  const [boxStatus, setBoxStatus] = useState<'recognized' | 'duplicate' | 'unrecognized' | 'scanning'>('scanning');
  const [displayInfo, setDisplayInfo] = useState<{
    firstName: string;
    lastName: string;
    group: string;
    idCode: string;
    time: string;
    confidence: number;
    message: string;
  } | null>(null);

  // Last event / history info
  const [lastResult, setLastResult] = useState<{
    type: 'success' | 'already' | 'unknown';
    student?: any;
    time?: string;
    message?: string;
    confidence?: number;
  } | null>(null);

  // Real webcam tracking box state
  const [webcamBox, setWebcamBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Cooldown & recognition tracking
  const lastCheckinMap = useRef<Map<string, number>>(new Map());
  const unrecognizedAlertCooldown = useRef<number>(0);
  const lastRecognizedTimestamp = useRef<number>(0);
  const consecutiveUnmatchedCount = useRef<number>(0);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [allStudents, setRes, statRes] = await Promise.all([
        api.getStudents(),
        api.getSettings(),
        api.getTodayStats()
      ]);

      const readyBiometrics: StudentBiometric[] = [];
      for (const st of allStudents) {
        if (st.face_descriptor && Array.isArray(st.face_descriptor) && st.face_descriptor.length === 128) {
          readyBiometrics.push({
            ...st,
            face_descriptor: st.face_descriptor,
            is_face_registered: 1
          } as StudentBiometric);
        } else if (st.photo_url) {
          // If student has a photo, include in biometric list and extract descriptor in background
          readyBiometrics.push({
            ...st,
            is_face_registered: 1
          } as StudentBiometric);
          extractDescriptorFromImageUrl(st.photo_url).then(async (desc) => {
            if (desc && desc.length === 128) {
              await api.registerFace(st.id, desc, st.photo_url);
              setRegisteredStudents(prev =>
                prev.map(p => p.id === st.id ? { ...p, face_descriptor: desc, is_face_registered: 1 } : p)
              );
            }
          }).catch(console.warn);
        }
      }

      setRegisteredStudents(readyBiometrics);
      setSettings(setRes);
      setTodayPresentCount(statRes.stats?.present_today || 0);
    } catch (err) {
      console.error('Error loading scanner data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stop physical webcam
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start physical webcam
  const startWebcam = useCallback(async () => {
    try {
      setCameraError(null);
      stopWebcam();
      setCameraMode('webcam');
      setIsActive(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error('Play error:', e));
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        'Vebkameraga ulanishda xatolik. Brauzer kamera ruxsatini yoqing yoki quyidagi "Talabalar oqimi" rejimini tanlang.'
      );
      setCameraMode('stream');
    }
  }, [stopWebcam]);

  // Switch to Stream Mode
  const startStreamMode = useCallback(() => {
    stopWebcam();
    setCameraMode('stream');
    setCameraError(null);
    setIsActive(true);
  }, [stopWebcam]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  // Handle a detected student (either from stream or webcam)
  const processFaceRecognition = useCallback(
    async (studentData: {
      id: string;
      first_name: string;
      last_name: string;
      student_id: string;
      group_name: string;
      photo_url: string;
      isRegistered: boolean;
    }) => {
      const nowStr = new Date().toTimeString().split(' ')[0];

      // If unrecognized / not registered
      if (!studentData.isRegistered) {
        setBoxStatus('unrecognized'); // QIZIL RAMKA!
        setDisplayInfo({
          firstName: 'NOMA’LUM',
          lastName: 'SHAXS',
          group: 'Ro‘yxatda yo‘q',
          idCode: 'ID: —',
          time: nowStr,
          confidence: 32,
          message: 'TANIMADI / NOMA’LUM SHAXS'
        });
        playUnrecognizedAlert();
        setLastResult({
          type: 'unknown',
          message: 'Tizimda o‘quvchi aniqlanmadi (yuz bazada mavjud emas)'
        });
        return;
      }

      // If registered student
      try {
        const res = await api.checkIn({
          student_id: studentData.id,
          method: 'face_id',
          match_confidence: 0.96
        });

        if (res.success) {
          if (res.already_recorded) {
            // SARIQ RAMKA - avval belgilangan
            setBoxStatus('duplicate');
            setDisplayInfo({
              firstName: studentData.first_name,
              lastName: studentData.last_name,
              group: studentData.group_name,
              idCode: studentData.student_id,
              time: res.record?.check_in_time || nowStr,
              confidence: 96,
              message: 'DAVOMAT AVVAL BELGILANGAN'
            });
            playDuplicateChime();
            setLastResult({
              type: 'already',
              student: studentData,
              time: res.record?.check_in_time,
              message: 'Davomat avval belgilangan'
            });
          } else {
            // YASHIL RAMKA - muvaffaqiyatli tanildi
            setBoxStatus('recognized');
            setDisplayInfo({
              firstName: studentData.first_name,
              lastName: studentData.last_name,
              group: studentData.group_name,
              idCode: studentData.student_id,
              time: res.record?.check_in_time || nowStr,
              confidence: 97,
              message: 'DAVOMAT BELGILANDI'
            });
            playSuccessChime();
            setTodayPresentCount(prev => prev + 1);
            setLastResult({
              type: 'success',
              student: studentData,
              time: res.record?.check_in_time,
              confidence: 0.97,
              message: 'Davomat belgilandi'
            });
            if (onAttendanceUpdated) onAttendanceUpdated();
          }
        }
      } catch (err) {
        console.error('Check-in error:', err);
      }
    },
    [onAttendanceUpdated]
  );

  // Auto-cycle through students in Stream mode
  useEffect(() => {
    if (!isActive || cameraMode !== 'stream') return;

    // Trigger recognition for current subject
    const safeIndex = currentSubjectIndex < testSubjects.length ? currentSubjectIndex : 0;
    const subject = testSubjects[safeIndex];
    if (!subject) return;

    setBoxStatus('scanning');
    setDisplayInfo({
      firstName: 'Aniqlanmoqda...',
      lastName: '',
      group: '',
      idCode: '',
      time: '',
      confidence: 0,
      message: 'Kameraga qaramoqda'
    });

    const timer = setTimeout(() => {
      processFaceRecognition(subject);
    }, 600);

    let cycleTimer: NodeJS.Timeout | null = null;
    if (isAutoCycling) {
      cycleTimer = setTimeout(() => {
        setCurrentSubjectIndex(prev => (prev + 1) % testSubjects.length);
      }, 4200);
    }

    return () => {
      clearTimeout(timer);
      if (cycleTimer) clearTimeout(cycleTimer);
    };
  }, [currentSubjectIndex, isActive, cameraMode, isAutoCycling, processFaceRecognition, testSubjects]);

  // Real Webcam frame analysis loop
  useEffect(() => {
    if (!isActive || cameraMode !== 'webcam') return;

    let animId: number;
    let counter = 0;

    const loop = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        counter++;
        if (counter % 8 === 0) {
          try {
            const video = videoRef.current;
            const det = await detectFace(video);
            if (det.detected) {
              const vw = video.videoWidth || 640;
              const vh = video.videoHeight || 480;
              const { x, y, width, height } = det.box;

              setWebcamBox({
                x: Math.round((x / vw) * 100),
                y: Math.round((y / vh) * 100),
                width: Math.round((width / vw) * 100),
                height: Math.round((height / vh) * 100)
              });

              const desc = await extractFaceDescriptor(video, det.box);
              const match = matchLiveFace(desc, registeredStudents, settings?.face_match_threshold || 0.55);
              const nowStr = new Date().toTimeString().split(' ')[0];

              if (match.matched && match.student) {
                consecutiveUnmatchedCount.current = 0;
                lastRecognizedTimestamp.current = Date.now();
                const stu = match.student;
                const lastSeen = lastCheckinMap.current.get(stu.id) || 0;

                if (Date.now() - lastSeen > 4000) {
                  lastCheckinMap.current.set(stu.id, Date.now());
                  processFaceRecognition({
                    id: stu.id,
                    first_name: stu.first_name,
                    last_name: stu.last_name,
                    student_id: stu.student_id,
                    group_name: stu.group_name || 'Guruh',
                    photo_url: stu.photo_url || '',
                    isRegistered: true
                  });
                } else {
                  // Keep displaying recognition banner during cooldown
                  setBoxStatus('recognized');
                  setDisplayInfo({
                    firstName: stu.first_name,
                    lastName: stu.last_name,
                    group: stu.group_name || 'Guruh',
                    idCode: stu.student_id,
                    time: nowStr,
                    confidence: match.confidencePercent || 96,
                    message: 'DAVOMAT QAYD ETILGAN'
                  });
                }
              } else {
                consecutiveUnmatchedCount.current++;
                // Only mark as unrecognized if face is unmatched for >= 3 frames and not in recognized latch window
                if (Date.now() - lastRecognizedTimestamp.current > 3500 && consecutiveUnmatchedCount.current >= 3) {
                  setBoxStatus('unrecognized'); // QIZIL RAMKA!
                  setDisplayInfo({
                    firstName: 'NOMA’LUM',
                    lastName: 'SHAXS',
                    group: 'Bazada yo‘q',
                    idCode: 'ID: —',
                    time: nowStr,
                    confidence: match.confidencePercent || 32,
                    message: 'TANIMADI / NOMA’LUM SHAXS'
                  });

                  if (Date.now() - unrecognizedAlertCooldown.current > 5000) {
                    unrecognizedAlertCooldown.current = Date.now();
                    playUnrecognizedAlert();
                  }
                }
              }
            } else {
              consecutiveUnmatchedCount.current = 0;
              if (Date.now() - lastRecognizedTimestamp.current > 3000) {
                setWebcamBox(null);
                setBoxStatus('scanning');
              }
            }
          } catch (e) {
            console.error('Webcam scan error:', e);
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isActive, cameraMode, registeredStudents, settings, processFaceRecognition]);

  const safeIndex = currentSubjectIndex < testSubjects.length ? currentSubjectIndex : 0;
  const currentSubject = testSubjects[safeIndex] || testSubjects[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Face ID orqali davomat
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Avtomatlashtirilgan
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kamerada to‘rtburchak ramka chiqadi, o‘quvchining familiyasi va ismi ekranda aks etadi. Agar qizil ramka chiqsa — shaxs tanilmagan bo‘ladi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle between Student stream & Webcam */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={startStreamMode}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                cameraMode === 'stream'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Talabalar kamerasi
            </button>
            <button
              type="button"
              onClick={startWebcam}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                cameraMode === 'webcam'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              Haqiqiy vebkamera
            </button>
          </div>

          {isActive ? (
            <button
              type="button"
              onClick={() => {
                setIsActive(false);
                stopWebcam();
              }}
              className="py-2 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              To‘xtatish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsActive(true);
                if (cameraMode === 'webcam') startWebcam();
              }}
              className="py-2 px-5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Davomatni boshlash
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Camera Viewport with Bounding Box & HUD (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-900">
                {cameraMode === 'stream' ? 'Jonli talabalar oqimi' : 'Vebkamera tasviri'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">
                {registeredStudents.length} ta yuz shabloni faol
              </span>
            </div>

            <div className="text-xs font-medium text-slate-700">
              Bugun kelganlar:{' '}
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {todayPresentCount} nafar
              </span>
            </div>
          </div>

          {/* Camera Frame Viewport */}
          <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden select-none">
            {cameraError ? (
              <div className="p-6 text-center max-w-sm">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                <p className="text-xs text-rose-200 mb-3">{cameraError}</p>
                <button
                  type="button"
                  onClick={startStreamMode}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Talabalar oqimiga o‘tish
                </button>
              </div>
            ) : !isActive ? (
              <div className="p-8 text-center text-slate-400">
                <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white mb-1">Kamera to‘xtatilgan</h4>
                <p className="text-xs text-slate-400 mb-4">
                  Davomat olish uchun yuqoridagi yashil tugmani bosing.
                </p>
                <button
                  type="button"
                  onClick={() => setIsActive(true)}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Kamerani yoqish
                </button>
              </div>
            ) : cameraMode === 'stream' ? (
              /* STREAM MODE: Displays Subject's Photo with Bounding Box */
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentSubject.photo_url}
                  alt="Student"
                  className="w-full h-full object-cover"
                />

                {/* TO'RTBURCHAK RAMKA (RECTANGULAR BOUNDING BOX) */}
                <div
                  style={{
                    left: `${currentSubject.box.x}%`,
                    top: `${currentSubject.box.y}%`,
                    width: `${currentSubject.box.width}%`,
                    height: `${currentSubject.box.height}%`
                  }}
                  className={`absolute pointer-events-none transition-all duration-300 rounded-xl ${
                    boxStatus === 'recognized'
                      ? 'border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.7)] bg-emerald-500/10'
                      : boxStatus === 'duplicate'
                      ? 'border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.7)] bg-amber-500/10'
                      : boxStatus === 'unrecognized'
                      ? 'border-4 border-rose-500 shadow-[0_0_35px_rgba(239,68,68,0.85)] bg-rose-500/20 animate-pulse'
                      : 'border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] bg-indigo-500/5'
                  }`}
                >
                  {/* Corner Accent Brackets */}
                  <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 ${
                    boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                  }`} />
                  <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 ${
                    boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                  }`} />
                  <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 ${
                    boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                  }`} />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 ${
                    boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                  }`} />

                  {/* EKRANDA ISMI VA FAMILIYASI (SURNAME AND FIRST NAME DIRECTLY OVER THE BOX) */}
                  <div className="absolute -top-16 inset-x-0 flex justify-center pointer-events-none">
                    <div
                      className={`px-4 py-2 rounded-xl backdrop-blur-md shadow-lg border text-center whitespace-nowrap min-w-[210px] transform -translate-y-2 ${
                        boxStatus === 'recognized'
                          ? 'bg-slate-900/90 border-emerald-500 text-white'
                          : boxStatus === 'duplicate'
                          ? 'bg-slate-900/90 border-amber-500 text-white'
                          : boxStatus === 'unrecognized'
                          ? 'bg-rose-950/95 border-rose-500 text-white ring-2 ring-rose-500/50'
                          : 'bg-slate-900/80 border-slate-700 text-white'
                      }`}
                    >
                      {boxStatus === 'unrecognized' ? (
                        <>
                          <div className="text-[11px] font-black uppercase tracking-wider text-rose-400 flex items-center justify-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            TANIMADI / NOMA’LUM SHAXS
                          </div>
                          <div className="text-xs font-semibold text-rose-100 mt-0.5">
                            O‘quvchilar bazasida mavjud emas!
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                            {displayInfo?.lastName} {displayInfo?.firstName}
                          </div>
                          <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1.5">
                            {boxStatus === 'recognized' ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                DAVOMAT BELGILANDI (97%)
                              </span>
                            ) : boxStatus === 'duplicate' ? (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                AVVAL QAYD ETILGAN ({displayInfo?.time})
                              </span>
                            ) : (
                              <span className="text-indigo-300">Yuz tahlil qilinmoqda...</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Camera Bottom HUD Ribbon */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-xs pointer-events-none">
                  <div className="px-3 py-1.5 bg-slate-900/85 backdrop-blur-sm rounded-lg text-white font-mono flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        boxStatus === 'recognized'
                          ? 'bg-emerald-400'
                          : boxStatus === 'unrecognized'
                          ? 'bg-rose-500 animate-ping'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span>{displayInfo?.message}</span>
                  </div>

                  <div className="px-3 py-1.5 bg-slate-900/85 backdrop-blur-sm rounded-lg text-white font-mono">
                    ID: {displayInfo?.idCode} · {displayInfo?.group}
                  </div>
                </div>
              </div>
            ) : (
              /* WEBCAM MODE */
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Webcam Bounding Box Overlay */}
                {webcamBox && (
                  <div
                    style={{
                      left: `${webcamBox.x}%`,
                      top: `${webcamBox.y}%`,
                      width: `${webcamBox.width}%`,
                      height: `${webcamBox.height}%`
                    }}
                    className={`absolute pointer-events-none rounded-xl transition-all duration-200 ${
                      boxStatus === 'recognized'
                        ? 'border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.7)] bg-emerald-500/10'
                        : boxStatus === 'duplicate'
                        ? 'border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.7)] bg-amber-500/10'
                        : boxStatus === 'unrecognized'
                        ? 'border-4 border-rose-500 shadow-[0_0_35px_rgba(239,68,68,0.85)] bg-rose-500/20 animate-pulse'
                        : 'border-2 border-indigo-400 bg-indigo-500/5'
                    }`}
                  >
                    {/* Corner Accent Brackets */}
                    <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 ${
                      boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                    }`} />
                    <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 ${
                      boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                    }`} />
                    <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 ${
                      boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                    }`} />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 ${
                      boxStatus === 'recognized' ? 'border-emerald-300' : boxStatus === 'unrecognized' ? 'border-rose-300' : 'border-amber-300'
                    }`} />

                    {/* Student Name and Status Banner directly over the box */}
                    <div className="absolute -top-16 inset-x-0 flex justify-center pointer-events-none">
                      <div
                        className={`px-4 py-2 rounded-xl backdrop-blur-md shadow-xl border text-center whitespace-nowrap min-w-[210px] transform -translate-y-2 ${
                          boxStatus === 'recognized'
                            ? 'bg-slate-900/95 border-emerald-500 text-white shadow-emerald-950/40'
                            : boxStatus === 'duplicate'
                            ? 'bg-slate-900/95 border-amber-500 text-white shadow-amber-950/40'
                            : boxStatus === 'unrecognized'
                            ? 'bg-rose-950/95 border-rose-500 text-white ring-2 ring-rose-500/50 shadow-rose-950/40'
                            : 'bg-slate-900/80 border-slate-700 text-white'
                        }`}
                      >
                        {boxStatus === 'unrecognized' ? (
                          <>
                            <div className="text-[11px] font-black uppercase tracking-wider text-rose-400 flex items-center justify-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              TANIMADI / NOMA’LUM SHAXS
                            </div>
                            <div className="text-[10px] font-semibold text-rose-200 mt-0.5">
                              O‘quvchilar bazasida mavjud emas! (qizil)
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-black text-white uppercase tracking-wider">
                              {displayInfo?.lastName} {displayInfo?.firstName}
                            </div>
                            <div className="text-[11px] font-semibold mt-0.5 flex items-center justify-center gap-1.5">
                              {boxStatus === 'recognized' ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  {displayInfo?.group || 'Guruh'} — DAVOMAT BELGILANDI ({displayInfo?.confidence || 96}%)
                                </span>
                              ) : boxStatus === 'duplicate' ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  {displayInfo?.group || 'Guruh'} — AVVAL QAYD ETILGAN ({displayInfo?.time})
                                </span>
                              ) : (
                                <span className="text-indigo-300">Yuz tahlil qilinmoqda...</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Subject Switcher Strip */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Talabani bitta bosish orqali kameraga chiqarish:
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoCycling}
                  onChange={e => setIsAutoCycling(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Avtomatik navbat</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {testSubjects.map((sub, idx) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setCurrentSubjectIndex(idx);
                    setCameraMode('stream');
                    setIsActive(true);
                  }}
                  className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center gap-2 ${
                    currentSubjectIndex === idx && cameraMode === 'stream'
                      ? sub.isRegistered
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                        : 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <img
                    src={sub.photo_url}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <div className="truncate">
                    <p className="font-semibold truncate">
                      {sub.last_name} {sub.first_name[0]}.
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {sub.isRegistered ? sub.group_name : 'Qizil: Tanimaydi'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Status & Today's Last Student Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Status Indicator Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              boxStatus === 'recognized'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : boxStatus === 'unrecognized'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : boxStatus === 'duplicate'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {boxStatus === 'recognized' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : boxStatus === 'unrecognized' ? (
                <UserX className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <h4 className="text-xs font-bold uppercase tracking-wide">
                {boxStatus === 'recognized'
                  ? 'O‘quvchi tanildi (Yashil)'
                  : boxStatus === 'unrecognized'
                  ? 'Qizil: Tizim tanimadi'
                  : 'Avval qayd qilingan (Sariq)'}
              </h4>
            </div>

            <p className="text-xs leading-relaxed">
              {boxStatus === 'recognized' && (
                <>O‘quvchi yuzi muvaffaqiyatli solishtirildi va bugungi davomat bazasiga kiritildi.</>
              )}
              {boxStatus === 'unrecognized' && (
                <>Ushbu shaxs o‘quvchilar ro‘yxatida mavjud emas. Davomat belgilanmadi.</>
              )}
              {boxStatus === 'duplicate' && (
                <>O‘quvchi bugun avval kiritilgan. Yangi takroriy davomat yaratilmadi.</>
              )}
            </p>
          </div>

          {/* Last Student Details Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Kameradagi shaxs ma’lumotlari
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <img
                    src={currentSubject.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">
                    {displayInfo?.lastName} {displayInfo?.firstName}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: {displayInfo?.idCode}
                  </p>
                  <p className="text-xs font-medium text-indigo-700 mt-0.5">
                    {displayInfo?.group}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Holat:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {boxStatus === 'recognized' ? (
                      <span className="text-emerald-700">Kelgan ✓</span>
                    ) : boxStatus === 'unrecognized' ? (
                      <span className="text-rose-700 font-bold">Tanimadi ✗</span>
                    ) : (
                      <span className="text-amber-700">Avval olingan</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Aniqlik:</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">
                    {displayInfo?.confidence}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-900">Belgilar qoidalari:</p>
            <ul className="space-y-1 text-slate-500 list-disc list-inside">
              <li><strong className="text-emerald-700 font-semibold">Yashil ramka:</strong> Talaba tanildi, ismi-familiyasi chiqdi va davomatga yozildi.</li>
              <li><strong className="text-rose-700 font-semibold">Qizil ramka:</strong> Tizim tanimayotgan bo‘ladi, bazadan topilmadi.</li>
              <li><strong className="text-amber-700 font-semibold">Sariq ramka:</strong> Davomat bugun avval olingan.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
