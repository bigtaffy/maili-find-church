import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RRule } from "rrule";
import type { MassTime } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const weekdayOrder: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function getMassSortMeta(mass: MassTime) {
  if (!mass.rrule) return { day: 99, hour: 99, minute: 99 };

  try {
    const options = RRule.parseString(mass.rrule);
    const rawDay = Array.isArray(options.byweekday) ? options.byweekday[0] : options.byweekday;
    const dayCode = rawDay == null ? '' : String(rawDay);
    const hour = Array.isArray(options.byhour) ? options.byhour[0] : options.byhour ?? 99;
    const minute = Array.isArray(options.byminute) ? options.byminute[0] : options.byminute ?? 99;

    return {
      day: weekdayOrder[dayCode] ?? 98,
      hour,
      minute,
    };
  } catch {
    return { day: 99, hour: 99, minute: 99 };
  }
}

export function sortMassTimes(masses: MassTime[]) {
  return [...masses].sort((a, b) => {
    const metaA = getMassSortMeta(a);
    const metaB = getMassSortMeta(b);

    if (metaA.day !== metaB.day) return metaA.day - metaB.day;
    if (metaA.hour !== metaB.hour) return metaA.hour - metaB.hour;
    if (metaA.minute !== metaB.minute) return metaA.minute - metaB.minute;
    return a.id - b.id;
  });
}

export function getMassDisplayTitle(mass: MassTime) {
  if (!mass.rrule) return mass.human_readable || '彌撒時間';

  try {
    const options = RRule.parseString(mass.rrule);
    const rawDay = Array.isArray(options.byweekday) ? options.byweekday[0] : options.byweekday;
    const dayCode = rawDay == null ? '' : String(rawDay);
    const weekdaysMap: Record<string, string> = {
      MO: '週一',
      TU: '週二',
      WE: '週三',
      TH: '週四',
      FR: '週五',
      SA: '週六',
      SU: '週日',
    };
    const dayLabel = weekdaysMap[dayCode] ?? (dayCode || '每週');
    const hour = Array.isArray(options.byhour) ? options.byhour[0] : options.byhour ?? 0;
    const minute = Array.isArray(options.byminute) ? options.byminute[0] : options.byminute ?? 0;
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    if (mass.mass_type?.type_code === 'sunday' && dayCode === 'SA') {
      return `主日前夕彌撒 ${timeLabel}`;
    }

    return `${dayLabel} ${timeLabel}`;
  } catch {
    return mass.human_readable || '彌撒時間';
  }
}
