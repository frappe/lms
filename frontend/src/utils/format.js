import { useTimeAgo } from '@vueuse/core'

export function timeAgo(date) {
	return useTimeAgo(date).value
}

// Frappe stores the date format in System Settings (e.g. "dd-mm-yyyy"); convert it to the dayjs tokens the DatePicker expects.
export function getDateFormat() {
	const fmt = window.sysdefaults?.date_format
	if (!fmt) return 'YYYY-MM-DD'
	return fmt.replace('yyyy', 'YYYY').replace('mm', 'MM').replace('dd', 'DD')
}

export const formatSeconds = (time) => {
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

// Single source of truth; decoders derive their inverse from this map.
export const HTML_ESCAPE_MAP = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
	'`': '&#x60;',
	'=': '&#x3D;',
}

export const escapeHTML = (text) => {
	if (!text) return ''
	return String(text).replace(/[&<>"'`=]/g, (char) => HTML_ESCAPE_MAP[char])
}

export const formatTimestamp = (seconds) => {
	const date = new Date(seconds * 1000)
	const hours = String(date.getUTCHours()).padStart(2, '0')
	const minutes = String(date.getUTCMinutes()).padStart(2, '0')
	const secs = String(date.getUTCSeconds()).padStart(2, '0')
	return hours > 0 ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`
}
