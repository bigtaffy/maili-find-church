import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ImagePlus, Loader2, MapPin, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import Map, { Marker, type MapLayerMouseEvent, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { api, type ParishDetail, type ParishReportComparableField, type ParishReportFormData, type ParishReportPayload, type ParishReportType } from '@/lib/api';
import { cn } from '@/lib/utils';

const OPEN_FREE_MAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAX_PHOTO_COUNT = 3;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const REPORT_FIELD_ORDER: ParishReportComparableField[] = [
  'name_zh',
  'name_en',
  'address',
  'phone',
  'email',
  'website',
  'fb_url',
  'ig_url',
  'priest_name',
];

function fileErrorMessage(file: File) {
  if (!file.type.startsWith('image/')) return `${file.name} 不是可接受的圖片格式。`;
  if (file.size > MAX_PHOTO_SIZE_BYTES) return `${file.name} 超過 5MB，請縮小後再上傳。`;
  return null;
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildInitialFormValues(reportForm: ParishReportFormData | null) {
  const entries = REPORT_FIELD_ORDER.map((field) => [field, reportForm?.current_data[field] ?? '']);
  return Object.fromEntries(entries) as Record<ParishReportComparableField, string>;
}

export function ReportError() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [church, setChurch] = useState<ParishDetail | null>(null);
  const [reportForm, setReportForm] = useState<ParishReportFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<ParishReportType[]>([]);
  const [formValues, setFormValues] = useState<Record<ParishReportComparableField, string>>(buildInitialFormValues(null));
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [correctedLocation, setCorrectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [viewState, setViewState] = useState({ latitude: 25.0478, longitude: 121.517, zoom: 15.2 });

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      try {
        const [detailRes, reportFormRes] = await Promise.all([
          api.getParishDetail(id),
          api.getParishReportForm(id),
        ]);

        setChurch(detailRes.data);
        setReportForm(reportFormRes.data);
        setFormValues(buildInitialFormValues(reportFormRes.data));
        setViewState({
          latitude: detailRes.data.latitude,
          longitude: detailRes.data.longitude,
          zoom: 15.2,
        });
      } catch (err) {
        console.error(err);
        setErrorMessage('無法載入回報表單，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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

  const comparableFields = useMemo(() => {
    return REPORT_FIELD_ORDER.filter((field) => reportForm?.comparable_fields[field]);
  }, [reportForm]);

  const locationDifferenceMeters = useMemo(() => {
    if (!church || !correctedLocation) return null;
    return haversineDistanceMeters(church.latitude, church.longitude, correctedLocation.lat, correctedLocation.lng);
  }, [church, correctedLocation]);

  function toggleReportType(type: ParishReportType) {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

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

  function handleMapClick(event: MapLayerMouseEvent) {
    setCorrectedLocation({
      lat: event.lngLat.lat,
      lng: event.lngLat.lng,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!church || !reportForm) return;

    if (selectedTypes.length === 0) {
      setErrorMessage('請至少勾選一個問題類型。');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const submittedData = Object.fromEntries(
        comparableFields
          .map((field) => {
            const currentValue = (reportForm.current_data[field] ?? '').trim();
            const nextValue = (formValues[field] ?? '').trim();
            if (nextValue === currentValue) return null;
            return [field, nextValue];
          })
          .filter((entry): entry is [ParishReportComparableField, string] => Boolean(entry)),
      );

      let finalDescription = description.trim();
      if (correctedLocation) {
        const originalCoords = `${church.latitude.toFixed(6)}, ${church.longitude.toFixed(6)}`;
        const suggestedCoords = `${correctedLocation.lat.toFixed(6)}, ${correctedLocation.lng.toFixed(6)}`;
        const locationNote = `\n\n[地圖標記建議位置]\n原始座標：${originalCoords}\n建議座標：${suggestedCoords}${
          locationDifferenceMeters != null ? `\n相差：約 ${locationDifferenceMeters} 公尺` : ''
        }`;
        finalDescription = `${finalDescription}${locationNote}`.trim();
      }

      const payload: ParishReportPayload = {
        reportTypes: selectedTypes,
        submittedData,
        reporterName,
        reporterEmail,
        reporterPhone,
        description: finalDescription,
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

  if (!church || !reportForm) {
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
            感謝你幫我們維護教堂資料。這筆回報已送出，管理員後續會依差異內容進行審核。
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
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900">{reportForm.parish_name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{church.address}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-4">問題類型</h2>
        <div className="flex flex-col gap-3 mb-8">
          {Object.entries(reportForm.report_types).map(([value, label]) => {
            const typedValue = value as ParishReportType;
            const checked = selectedTypes.includes(typedValue);

            return (
              <label
                key={typedValue}
                className={cn(
                  'flex items-center justify-between gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                  checked ? 'border-blue-600 bg-blue-50/30' : 'border-gray-200 bg-white',
                )}
              >
                <span className="text-gray-900">{label}</span>
                <div
                  className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center',
                    checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white',
                  )}
                >
                  {checked && <div className="w-2.5 h-2.5 rounded-sm bg-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleReportType(typedValue)}
                  className="hidden"
                />
              </label>
            );
          })}
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">建議更正資料</h2>
            <p className="mt-1 text-sm text-gray-500">只有修改過的欄位會送出，沒改的內容不會送。</p>
          </div>
          <div className="grid gap-4">
            {comparableFields.map((field) => (
              <div key={field}>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {reportForm.comparable_fields[field]}
                </label>
                <input
                  type="text"
                  value={formValues[field] ?? ''}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-600"
                />
                {reportForm.current_data[field] ? (
                  <p className="mt-2 text-xs text-slate-400">目前資料：{reportForm.current_data[field]}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">目前資料：未提供</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">教堂位置比對</h2>
            <p className="mt-1 text-sm text-gray-500">點地圖可標出建議位置，藍色是原位置，綠色是你標的新位置。</p>
          </div>

          <div className="overflow-hidden rounded-3xl ring-1 ring-slate-200">
            <Map
              mapLib={maplibregl}
              {...viewState}
              onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
              onClick={handleMapClick}
              dragRotate={false}
              touchZoomRotate={false}
              minZoom={5.2}
              maxZoom={19}
              style={{ width: '100%', height: 260 }}
              mapStyle={OPEN_FREE_MAP_LIBERTY_STYLE}
            >
              <Marker longitude={church.longitude} latitude={church.latitude} anchor="bottom">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600/18 p-1 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                  <div className="flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-blue-600 text-white ring-2 ring-blue-100/80">
                    <MapPin className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                </div>
              </Marker>

              {correctedLocation && (
                <Marker
                  longitude={correctedLocation.lng}
                  latitude={correctedLocation.lat}
                  anchor="bottom"
                  draggable
                  onDragEnd={(event) =>
                    setCorrectedLocation({
                      lat: event.lngLat.lat,
                      lng: event.lngLat.lng,
                    })
                  }
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/18 p-1 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                    <div className="flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-emerald-600 text-white ring-2 ring-emerald-100/80">
                      <MapPin className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                  </div>
                </Marker>
              )}
            </Map>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">原始位置</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {church.latitude.toFixed(6)}, {church.longitude.toFixed(6)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 px-4 py-3">
              <p className="text-xs font-medium text-emerald-700">建議位置</p>
              {correctedLocation ? (
                <>
                  <p className="mt-1 text-sm font-medium text-emerald-900">
                    {correctedLocation.lat.toFixed(6)}, {correctedLocation.lng.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">與原位置相差約 {locationDifferenceMeters} 公尺</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-emerald-800">尚未標記，點地圖即可設定。</p>
              )}
            </div>
          </div>

          {correctedLocation && (
            <button
              type="button"
              onClick={() => setCorrectedLocation(null)}
              className="mt-3 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 active:bg-slate-200"
            >
              清除建議位置
            </button>
          )}
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
          <h2 className="text-lg font-bold text-gray-900 mb-4">補充說明</h2>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 h-32 outline-none focus:border-blue-600 resize-none text-gray-700"
            placeholder="請盡可能提供詳細資訊，例如正確的彌撒時間、新的聯絡電話，或位置修正的補充說明。"
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
