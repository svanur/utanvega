// #1461/#1462: .toFixed() always renders a period, regardless of UI language — wrong for
// Icelandic, which uses a comma decimal separator. Intl.NumberFormat keyed off i18n.language
// fixes the separator for every decimal stat on ClimateCard and WeatherCard without touching
// unit suffixes (m/s, mm, h), which are already language-neutral text.
export function formatDecimal(value: number, language: string, fractionDigits = 1): string {
    return new Intl.NumberFormat(language, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);
}
