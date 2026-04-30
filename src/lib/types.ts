export type ParishSummary = {
  id: number;
  name_zh: string;
  name_local?: string | null;
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
  | 'wrong_email'
  | 'wrong_website'
  | 'wrong_priest'
  | 'closed_permanently'
  | 'closed_temporarily'
  | 'info_outdated'
  | 'other';

export type ParishReportPhoto = {
  url: string;
  original_name: string;
};

export type ParishReport = {
  id: number;
  parish_id: number;
  report_types: ParishReportType[];
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected' | string;
  has_diff?: boolean;
  diff_count?: number;
  photos: ParishReportPhoto[];
  created_at: string;
};

export type ParishReportComparableField =
  | 'name_zh'
  | 'name_en'
  | 'address'
  | 'phone'
  | 'email'
  | 'website'
  | 'fb_url'
  | 'ig_url'
  | 'priest_name';

export type ParishReportFormData = {
  parish_id: number;
  parish_name: string;
  current_data: Partial<Record<ParishReportComparableField, string | null>>;
  report_types: Record<ParishReportType, string>;
  comparable_fields: Partial<Record<ParishReportComparableField, string>>;
};

export type ParishReportPayload = {
  reportTypes: ParishReportType[];
  submittedData?: Partial<Record<ParishReportComparableField, string>>;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  description?: string;
  photos?: File[];
  turnstileToken?: string;
};

export type PilgrimageVerificationMethod = 'gps' | 'manual';

export type PilgrimageStamp = {
  parish_id: number;
  stamped_at: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  verification_method: PilgrimageVerificationMethod;
};

export type PilgrimageStampMap = Record<string, PilgrimageStamp>;

export type WishCategory = 'self' | 'family' | 'world';

export type WishStatus = 'pending' | 'fulfilled' | 'released';

export type PilgrimageWish = {
  category: WishCategory;
  content: string;
  status: WishStatus;
  created_at: string;
  updated_at: string;
};

export type PilgrimageWishSlots = {
  1: PilgrimageWish | null;
  2: PilgrimageWish | null;
  3: PilgrimageWish | null;
};

export type PilgrimageWishMap = Record<string, PilgrimageWishSlots>;

export type PilgrimageUiState = {
  stamp_intro_seen?: boolean;
  wish_intro_seen?: boolean;
  wish_local_only_notice_seen?: boolean;
};
