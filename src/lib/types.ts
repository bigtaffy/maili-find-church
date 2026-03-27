export type ParishSummary = {
  id: number;
  name_zh: string;
  name_en?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  distance_km?: number | null;
  diocese?: {
    id: number;
    name_zh: string;
    name_en?: string | null;
  } | null;
};

export type MassTime = {
  id: number;
  rrule?: string | null;
  human_readable?: string | null;
  dtstart?: string | null;
  duration_minutes?: number | null;
  language?: string | null;
  label?: string | null;
  location_note?: string | null;
  remarks?: string | null;
  mass_type?: {
    type_code?: string | null;
    name_zh?: string | null;
  } | null;
};

export type ParishPhoto = {
  image_url: string;
  description?: string | null;
};

export type Priest = {
  id?: number;
  name_zh?: string | null;
  name_en?: string | null;
  title?: string | null;
  role?: string | null;
  is_active?: boolean;
};

export type ParishDetail = ParishSummary & {
  email?: string | null;
  fb_url?: string | null;
  ig_url?: string | null;
  priest_name?: string | null;
  has_sub_venues?: boolean;
  deanery?: {
    id: number;
    name_zh: string;
  } | null;
  city?: {
    id: number;
    name_zh: string;
  } | null;
  mass_times: MassTime[];
  photos: ParishPhoto[];
  priests: Priest[];
};

export type UpcomingMass = {
  parish: ParishSummary;
  mass_time: MassTime | null;
  next_at?: string | null;
  minutes_away?: number | null;
  distance_km?: number | null;
};

export type CollectionResponse<T> = {
  data: T[];
};

export type SingleResponse<T> = {
  data: T;
};

export type OfflineSyncState = {
  ready: boolean;
  source: 'remote' | 'cache' | 'none';
  version: number | null;
  updatedAt: string | null;
  isStale: boolean;
  lastSyncAt: string | null;
  error?: string | null;
};

export type ParishReportType =
  | 'wrong_address'
  | 'wrong_mass_time'
  | 'wrong_phone'
  | 'wrong_website'
  | 'closed_permanently'
  | 'closed_temporarily'
  | 'other';

export type ParishReportPhoto = {
  url: string;
  original_name: string;
};

export type ParishReport = {
  id: number;
  parish_id: number;
  report_type: ParishReportType;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected' | string;
  photos: ParishReportPhoto[];
  created_at: string;
};

export type ParishReportPayload = {
  reportType: ParishReportType;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  description?: string;
  photos?: File[];
};
