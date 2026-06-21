import { useQuery } from '@tanstack/react-query';

export interface IcelandicHoliday {
    date: string;
    name: string;
    nameEn: string;
}

type HolidayMap = Record<string, IcelandicHoliday[]>;

async function fetchHolidays(): Promise<HolidayMap> {
    const res = await fetch('/data/is-holidays.json');
    if (!res.ok) throw new Error('Failed to load holidays');
    return res.json() as Promise<HolidayMap>;
}

export function useIcelandicHolidays() {
    const { data } = useQuery<HolidayMap>({
        queryKey: ['is-holidays'],
        queryFn: fetchHolidays,
        staleTime: Infinity,
    });

    function getHolidays(dateStr: string): IcelandicHoliday[] {
        if (!data || !dateStr) return [];
        const year = dateStr.slice(0, 4);
        return (data[year] ?? []).filter(h => h.date === dateStr);
    }

    function isHoliday(dateStr: string): boolean {
        return getHolidays(dateStr).length > 0;
    }

    return { getHolidays, isHoliday };
}
