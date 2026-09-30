import type { ChartValueFormatter } from 'frappe-ui/charts'

const formatters = new Map<string, Intl.NumberFormat>()

function documentLocale(): string {
	const lang = document.documentElement.lang
	if (!lang) return 'en-US'
	try {
		Intl.getCanonicalLocales(lang)
		return lang
	} catch {
		return 'en-US'
	}
}

function compactFormatter(locale: string): Intl.NumberFormat {
	let formatter = formatters.get(locale)
	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, {
			notation: 'compact',
			maximumFractionDigits: 1,
		})
		formatters.set(locale, formatter)
	}
	return formatter
}

export const compactNumber: ChartValueFormatter = (value) =>
	compactFormatter(documentLocale()).format(value)
