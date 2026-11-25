import type {
	AnalyticsFormat,
	AnalyticsKind,
	AnalyticsPreview,
	AnalyticsTimeFrame,
	AnalyticsWindow,
} from '@/types'

const PRESET_DAYS: Record<'7d' | '30d' | '90d', number> = {
	'7d': 7,
	'30d': 30,
	'90d': 90,
}
// The sheet a report is laid out on, in CSS pixels.
export interface ReportPage {
	width: number
	padding: number
}
const IMAGE_PAGE: ReportPage = { width: 960, padding: 40 }
// What wkhtmltopdf makes of A4 with 15mm margins, read off a real export.
const PDF_PAGE: ReportPage = { width: 1058, padding: 84 }
const PAPER = '#ffffff' // token-exempt: an exported image is on white paper in any theme
// Chromium will not draw a canvas taller than this.
const MAX_CANVAS_HEIGHT = 16000

export function isoDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

// "Last 7 days" is today and the six days before it.
export function timeFrameWindow(
	frame: AnalyticsTimeFrame,
	custom: AnalyticsWindow,
	today: Date = new Date()
): AnalyticsWindow {
	if (frame === 'all') return { from_date: null, to_date: null }
	if (frame === 'custom') return custom
	const from = new Date(today)
	from.setDate(from.getDate() - (PRESET_DAYS[frame] - 1))
	return { from_date: isoDay(from), to_date: isoDay(today) }
}

export function analyticsFilename(
	name: string,
	format: AnalyticsFormat
): string {
	return `${name.replace(/[^A-Za-z0-9_-]+/g, '-')}-analytics.${format}`
}

function query(
	kind: AnalyticsKind,
	name: string,
	window: AnalyticsWindow,
	extra: Record<string, string> = {}
): string {
	const params = new URLSearchParams({ [kind]: name, ...extra })
	if (window.from_date) params.set('from_date', window.from_date)
	if (window.to_date) params.set('to_date', window.to_date)
	return params.toString()
}

interface ServerMessage {
	message?: string
}

// Frappe answers a failed call with JSON carrying the user-facing message.
async function failure(response: Response): Promise<Error> {
	const fallback = __('The server answered {0}. Try again.').format(
		String(response.status)
	)
	const failed = (message: string, exc_type?: string): Error =>
		Object.assign(new Error(message), { status: response.status, exc_type })
	try {
		const body = (await response.json()) as {
			_server_messages?: string
			exception?: string
			exc_type?: string
		}
		const messages: string[] = JSON.parse(body._server_messages || '[]')
		const first = messages[0]
			? (JSON.parse(messages[0]) as ServerMessage).message
			: null
		return failed(first || fallback, body.exc_type)
	} catch {
		return failed(fallback)
	}
}

async function request(url: string): Promise<Response> {
	const response = await fetch(url, {
		headers: { 'X-Frappe-CSRF-Token': window.csrf_token || '' },
	})
	if (!response.ok) throw await failure(response)
	return response
}

function save(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function reportPage(format: AnalyticsFormat): ReportPage {
	return format === 'pdf' ? PDF_PAGE : IMAGE_PAGE
}

export function reportDocument(html: string, page: ReportPage): string {
	return `<!DOCTYPE html><html><body style="margin: 0;"><div style="padding: ${page.padding}px; background-color: ${PAPER};">${html}</div></body></html>`
}

// A sandboxed frame with no scripts lays the report out so it can be measured,
// then the laid-out markup is serialised as XHTML for the SVG.
export async function measureReport(
	html: string,
	page: ReportPage
): Promise<{ xhtml: string; height: number }> {
	const frame = document.createElement('iframe')
	frame.setAttribute('sandbox', 'allow-same-origin')
	frame.setAttribute('aria-hidden', 'true')
	frame.style.cssText = `position: fixed; top: 0; inset-inline-start: -${
		page.width * 2
	}px; width: ${page.width}px; height: 10px; border: 0; visibility: hidden;`
	const loaded = new Promise((resolve) => (frame.onload = resolve))
	frame.srcdoc = reportDocument(html, page)
	document.body.append(frame)
	try {
		await loaded
		const sheet = frame.contentDocument?.body.firstElementChild
		if (!sheet) throw new Error(__('The report could not be laid out.'))
		return {
			xhtml: new XMLSerializer().serializeToString(sheet),
			height: Math.ceil(sheet.getBoundingClientRect().height),
		}
	} finally {
		frame.remove()
	}
}

export async function rasterize(html: string): Promise<Blob> {
	const { width: IMAGE_WIDTH } = IMAGE_PAGE
	const { xhtml, height } = await measureReport(html, IMAGE_PAGE)
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`
	const image = new Image()
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
	await image.decode()

	const scale = Math.min(2, MAX_CANVAS_HEIGHT / height)
	const canvas = document.createElement('canvas')
	canvas.width = Math.round(IMAGE_WIDTH * scale)
	canvas.height = Math.round(height * scale)
	const context = canvas.getContext('2d')
	if (!context) throw new Error(__('This browser cannot draw images.'))
	context.scale(scale, scale)
	context.fillStyle = PAPER
	context.fillRect(0, 0, IMAGE_WIDTH, height)
	context.drawImage(image, 0, 0)
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) =>
			blob
				? resolve(blob)
				: reject(new Error(__('The image could not be created.')))
		)
	)
}

export async function fetchAnalyticsPreview(
	kind: AnalyticsKind,
	name: string,
	format: AnalyticsFormat,
	window: AnalyticsWindow
): Promise<AnalyticsPreview> {
	const response = await request(
		`/api/method/lms.lms.dashboard.${kind}.get_${kind}_analytics_preview?${query(
			kind,
			name,
			window,
			{ file_format: format }
		)}`
	)
	const { message } = (await response.json()) as { message: AnalyticsPreview }
	return message
}

export async function downloadAnalytics(
	kind: AnalyticsKind,
	name: string,
	format: AnalyticsFormat,
	window: AnalyticsWindow
): Promise<void> {
	const filename = analyticsFilename(name, format)
	if (format === 'png') {
		const response = await request(
			`/api/method/lms.lms.dashboard.${kind}.get_${kind}_analytics_report?${query(
				kind,
				name,
				window
			)}`
		)
		const { message } = (await response.json()) as { message: string }
		save(await rasterize(message), filename)
		return
	}
	const response = await request(
		`/api/method/lms.lms.dashboard.${kind}.export_${kind}_analytics?${query(
			kind,
			name,
			window,
			{ file_format: format }
		)}`
	)
	save(await response.blob(), filename)
}

type Cell = string | number | null | undefined

// A spreadsheet runs a cell that starts with one of these as a formula. The
// cells here hold text students typed, so a leading quote keeps it as text.
const FORMULA_START = /^[=+\-@\t\r]/

function toCell(value: Cell): string {
	let text = value == null ? '' : String(value)
	if (FORMULA_START.test(text)) text = `'${text}`
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: Cell[][]): string {
	return rows.map((row) => row.map(toCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, rows: Cell[][]): void {
	// The byte order mark makes Excel read the file as UTF-8.
	const blob = new Blob(['﻿', toCsv(rows)], {
		type: 'text/csv;charset=utf-8',
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}
