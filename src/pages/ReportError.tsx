import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { api, type ParishDetail, type ParishReportPayload, type ParishReportType } from '@/lib/api';
import { cn } from '@/lib/utils';

const REPORT_TYPE_OPTIONS: Array<{ value: ParishReportType; label: string }> = [
  { value: 'wrong_address', label: '地址錯誤' },
  { value: 'wrong_mass_time', label: '彌撒時間錯誤' },
  { value: 'wrong_phone', label: '電話錯誤' },
  { value: 'wrong_website', label: '網站錯誤' },
  { value: 'closed_permanently', label: '已永久關閉' },
  { value: 'closed_temporarily', label: '暫時關閉' },
  { value: 'other', label: '其他' },
];

const MAX_PHOTO_COUNT = 3;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function fileErrorMessage(file: File) {
  if (!file.type.startsWith('image/')) return `${file.name} 不是可接受的圖片格式。`;
  if (file.size > MAX_PHOTO_SIZE_BYTES) return `${file.name} 超過 5MB，請縮小後再上傳。`;
  return null;
}

export function ReportError() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [church, setChurch] = useState<ParishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ParishReportType>('other');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;

      try {
        const res = await api.getParishDetail(id);
        setChurch(res.data);
      } catch (err) {
        console.error(err);
        setErrorMessage('找不到這間教堂，請返回上一頁再試一次。');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    setErrorMessage(null);

    if (incomingFiles.length === 0) return;

    const nextFiles = [...photos, ...incomingFiles].slice(0, MAX_PHOTO_COUNT);
    const invalidFile = nextFiles.find(fileErrorMessage);

    if (invalidFile) {
      setErrorMessage(fileErrorMessage(invalidFile));
      return;
    }

    if (photos.length + incomingFiles.length > MAX_PHOTO_COUNT) {
      setErrorMessage('最多只能上傳 3 張照片。');
    }

    setPhotos(nextFiles);
  }

  function removePhoto(target: File) {
    setPhotos((current) => current.filter((file) => file !== target));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!church) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: ParishReportPayload = {
        reportType: selectedType,
        reporterName,
        reporterEmail,
        reporterPhone,
        description,
        photos,
      };

      await api.submitParishReport(church.id, payload);
      setSubmitSuccess(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : '送出回報失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">{errorMessage || '找不到此教堂'}</p>
        <button onClick={() => navigate(-1)} className="bg-blue-600 text-white px-6 py-2 rounded-full">
          返回上一頁
        </button>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="mx-auto max-w-xl rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">回報已送出</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            感謝你幫我們維護教堂資料。這筆回報已送出，後台審核後會再處理。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`/church/${church.id}`)}
              className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white active:bg-blue-700"
            >
              返回教堂詳情
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 active:bg-slate-200"
            >
              回到首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">回報教堂資訊錯誤</h1>
      </div>

      <form id="parish-report-form" onSubmit={handleSubmit} className="px-4 py-6 flex-1 overflow-y-auto">
        <p className="text-sm text-gray-500 mb-2">回報教堂</p>
        <div className="bg-blue-50/50 rounded-2xl p-4 flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900">{church.name_zh}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{church.address}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-4">問題類型</h2>
        <div className="flex flex-col gap-3 mb-8">
          {REPORT_TYPE_OPTIONS.map((type) => (
            <label
              key={type.value}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors',
                selectedType === type.value ? 'border-blue-600 bg-blue-50/30' : 'border-gray-200 bg-white',
              )}
            >
              <span className="text-gray-900">{type.label}</span>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border flex items-center justify-center',
                  selectedType === type.value ? 'border-blue-600' : 'border-gray-300',
                )}
              >
                {selectedType === type.value && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
              </div>
              <input
                type="radio"
                name="errorType"
                value={type.value}
                checked={selectedType === type.value}
                onChange={() => setSelectedType(type.value)}
                className="hidden"
              />
            </label>
          ))}
        </div>

        <div className="mb-8 grid gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">聯絡方式</h2>
            <p className="mb-4 text-sm text-gray-500">這些欄位都可不填。若願意留下聯絡方式，管理員在需要時比較容易確認。</p>
          </div>
          <input
            type="text"
            value={reporterName}
            onChange={(event) => setReporterName(event.target.value)}
            placeholder="姓名（選填）"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-600"
          />
          <input
            type="email"
            value={reporterEmail}
            onChange={(event) => setReporterEmail(event.target.value)}
            placeholder="Email（選填）"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-600"
          />
          <input
            type="tel"
            value={reporterPhone}
            onChange={(event) => setReporterPhone(event.target.value)}
            placeholder="電話（選填）"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">詳細說明</h2>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 h-32 outline-none focus:border-blue-600 resize-none text-gray-700"
            placeholder="請盡可能提供詳細資訊，例如正確的彌撒時間、新的聯絡電話等，以幫助我們加快處理速度。"
          />
          <p className="mt-2 text-right text-xs text-gray-400">{description.length}/2000</p>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">佐證照片</h2>
              <p className="text-sm text-gray-500">選填，最多 3 張，每張不超過 5MB。</p>
            </div>
            <label className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
              photos.length >= MAX_PHOTO_COUNT ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white cursor-pointer active:bg-slate-800',
            )}>
              <ImagePlus className="h-4 w-4" />
              加照片
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
                disabled={photos.length >= MAX_PHOTO_COUNT}
              />
            </label>
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {photoPreviews.map((preview) => (
                <div key={`${preview.file.name}-${preview.file.lastModified}`} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  <img src={preview.url} alt={preview.file.name} className="h-28 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(preview.file)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                    aria-label={`移除 ${preview.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              目前沒有附圖，純文字回報也可以送出。
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>

      <div className="p-4 bg-white border-t border-gray-100 pb-safe">
        <button
          type="submit"
          form="parish-report-form"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium active:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {submitting ? '送出中...' : '送出回報'}
        </button>
      </div>
    </div>
  );
}
