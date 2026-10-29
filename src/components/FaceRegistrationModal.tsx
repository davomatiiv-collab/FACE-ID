import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { detectFace, extractFaceDescriptor } from '../utils/faceRecognition.ts';
import { api, Student } from '../api/client.ts';

interface FaceRegistrationModalProps {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
}

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  student,
  onClose,
  onSuccess
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qualityStatus, setQualityStatus] = useState<'searching' | 'good' | 'too_close' | 'too_far'>('searching');
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const attachStreamToVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn('Registration video play:', e));
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        attachStreamToVideo();
      }, 50);
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Kameraga ulanishda xatolik yuz berdi.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Kamera ruxsati berilmadi. Brauzer manzil satrida ruxsatni yoqing.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Vebkamera topilmadi.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [stopCamera, attachStreamToVideo]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Periodic face detector overlay in video
  useEffect(() => {
    if (!cameraActive || capturedSnapshot) return;

    let animId: number;
    const checkFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          try {
            const det = await detectFace(video);
            if (det.detected) {
              const { x, y, width, height } = det.box;
              const ratio = width / canvas.width;

              if (ratio < 0.2) {
                setQualityStatus('too_far');
              } else if (ratio > 0.75) {
                setQualityStatus('too_close');
              } else {
                setQualityStatus('good');
              }

              // Draw biometric reticle
              ctx.strokeStyle = qualityStatus === 'good' ? '#10b981' : '#f59e0b';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y, width, height);

              // Draw corner brackets
              const cornerLen = Math.min(24, width * 0.2);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 4;
              // Top-left
              ctx.beginPath();
              ctx.moveTo(x, y + cornerLen);
              ctx.lineTo(x, y);
              ctx.lineTo(x + cornerLen, y);
              ctx.stroke();
              // Top-right
              ctx.beginPath();
              ctx.moveTo(x + width - cornerLen, y);
              ctx.lineTo(x + width, y);
              ctx.lineTo(x + width, y + cornerLen);
              ctx.stroke();
              // Bottom-left
              ctx.beginPath();
              ctx.moveTo(x, y + height - cornerLen);
              ctx.lineTo(x, y + height);
              ctx.lineTo(x + cornerLen, y + height);
              ctx.stroke();
              // Bottom-right
              ctx.beginPath();
              ctx.moveTo(x + width - cornerLen, y + height);
              ctx.lineTo(x + width, y + height);
              ctx.lineTo(x + width, y + height - cornerLen);
              ctx.stroke();
            } else {
              setQualityStatus('searching');
            }
          } catch {
            // Ignore frame error
          }
        }
      }
      animId = requestAnimationFrame(checkFrame);
    };

    animId = requestAnimationFrame(checkFrame);
    return () => cancelAnimationFrame(animId);
  }, [cameraActive, capturedSnapshot, qualityStatus]);

  const captureAndExtract = async () => {
    if (!videoRef.current) return;
    setIsAnalyzing(true);
    try {
      const video = videoRef.current;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth || 640;
      snapCanvas.height = video.videoHeight || 480;
      const ctx = snapCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
      const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.85);

      const det = await detectFace(video);
      const desc = await extractFaceDescriptor(video, det.box);

      setCapturedSnapshot(dataUrl);
      setDescriptor(desc);
      stopCamera();
    } catch (err: any) {
      console.error('Extraction error:', err);
      alert('Yuzni tahlil qilishda xatolik: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveBiometrics = async () => {
    if (!descriptor || !capturedSnapshot) return;
    setIsSaving(true);
    try {
      const res = await api.registerFace(student.id, descriptor, capturedSnapshot);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        alert(res.error || 'Saqlashda xatolik yuz berdi');
      }
    } catch (err: any) {
      alert('Tarmoq xatosi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    setCapturedSnapshot(null);
    setDescriptor(null);
    setSaveSuccess(false);
    startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Yuzni ro‘yxatdan o‘tkazish (Face ID)
            </h3>
            <p className="text-xs text-slate-500">
              {student.first_name} {student.last_name} ({student.student_id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {cameraError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium">Kamera xatosi</p>
                  <p className="text-xs mt-1 text-red-600 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Qayta urinish
                  </button>
                </div>
              </div>
            </div>
          ) : !capturedSnapshot ? (
            <div className="space-y-4">
              <div className="relative aspect-4/3 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                <video
                  ref={el => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
                />

                {/* Quality guidance badge */}
                <div className="absolute top-3 inset-x-3 flex justify-center">
                  <div className="px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-md text-xs font-medium text-white shadow-sm flex items-center gap-1.5">
                    {qualityStatus === 'good' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Yuz holati a’lo — suratga olish mumkin</span>
                      </>
                    )}
                    {qualityStatus === 'too_far' && (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kameraga yaqinroq keling</span>
                      </>
                    )}
                    {qualityStatus === 'too_close' && (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kameradan biroz uzoqlashing</span>
                      </>
                    )}
                    {qualityStatus === 'searching' && (
                      <>
                        <Camera className="w-3.5 h-3.5 text-slate-300" />
                        <span>Kameraga to‘g‘ri qarang</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  128-o‘lchamli lokal biometrik shablon
                </span>
                <span>Oflayn va xavfsiz</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={captureAndExtract}
                  disabled={isAnalyzing}
                  className="flex-2 py-2.5 px-4 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  {isAnalyzing ? 'Tahlil qilinmoqda...' : 'Suratga olish va shablon yaratish'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-4/3 bg-slate-900 rounded-lg overflow-hidden border border-slate-200">
                <img
                  src={capturedSnapshot}
                  alt="Face snapshot"
                  className="w-full h-full object-cover"
                />
                {saveSuccess && (
                  <div className="absolute inset-0 bg-emerald-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                    <p className="font-semibold text-sm">Yuz muvaffaqiyatli ro‘yxatdan o‘tkazildi!</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-1">
                <div className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Yuz shabloni muvaffaqiyatli shakllantirildi
                </div>
                <p className="text-emerald-700">
                  128 ta biometrik parametr hisoblab chiqildi. Ushbu shablon lokal SQLite bazasida o‘quvchining ID raqamiga biriktiriladi.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSaving || saveSuccess}
                  className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Qayta suratga olish
                </button>
                <button
                  type="button"
                  onClick={handleSaveBiometrics}
                  disabled={isSaving || saveSuccess}
                  className="flex-2 py-2.5 px-4 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSaving ? 'Saqlanmoqda...' : 'Bazaga saqlash'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
