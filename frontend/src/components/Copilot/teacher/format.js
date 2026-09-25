// Labels, badges and small formatters shared by the teacher Copilot screens.
// Every label is a literal __() call so the translation extractor finds it.
import { htmlToText } from '@/utils/inertHtml'

const KINDS = {
	feedback: () => __('Project feedback'),
	'Lesson Change': () => __('Lesson change'),
	'Lesson Quiz': () => __('Lesson quiz'),
	'Learner Reminder': () => __('Learner reminder'),
	Escalation: () => __('Question for you'),
	Rubric: () => __('Rubric'),
	'Course Draft': () => __('Course draft'),
}

export const KIND_KEYS = Object.keys(KINDS)

export function kindLabel(kind) {
	return KINDS[kind] ? KINDS[kind]() : kind || ''
}

const CONFIDENCE = {
	High: [() => __('High'), 'green'],
	Medium: [() => __('Medium'), 'amber'],
	Low: [() => __('Low'), 'red'],
}

export function confidenceLabel(value) {
	return CONFIDENCE[value] ? CONFIDENCE[value][0]() : value || '—'
}

export function confidenceTheme(value) {
	return CONFIDENCE[value] ? CONFIDENCE[value][1] : 'gray'
}

const STATUSES = {
	Draft: [() => __('Draft'), 'gray'],
	Pending: [() => __('Pending'), 'amber'],
	'Pending Review': [() => __('Pending Review'), 'amber'],
	'Rewrite Requested': [() => __('Rewrite Requested'), 'amber'],
	Queued: [() => __('Queued'), 'amber'],
	Submitted: [() => __('Submitted'), 'amber'],
	'Awaiting Review': [() => __('Awaiting Review'), 'amber'],
	Ready: [() => __('Ready'), 'green'],
	Approved: [() => __('Approved'), 'green'],
	Applied: [() => __('Applied'), 'green'],
	'Feedback Sent': [() => __('Feedback Sent'), 'green'],
	Pass: [() => __('Pass'), 'green'],
	Fail: [() => __('Fail'), 'amber'],
	'Not Graded': [() => __('Not Graded'), 'gray'],
	Rejected: [() => __('Rejected'), 'gray'],
	Expired: [() => __('Expired'), 'gray'],
	Superseded: [() => __('Superseded'), 'gray'],
	Failed: [() => __('Failed'), 'red'],
	Error: [() => __('Error'), 'red'],
}

export function statusLabel(status) {
	return STATUSES[status] ? STATUSES[status][0]() : status || ''
}

export function statusTheme(status) {
	return STATUSES[status] ? STATUSES[status][1] : 'gray'
}

const EDIT_LEVELS = {
	Unchanged: () => __('Unchanged'),
	Light: () => __('Light'),
	Rewrite: () => __('Rewrite'),
}

export function editLevelLabel(level) {
	return EDIT_LEVELS[level] ? EDIT_LEVELS[level]() : level || ''
}

const VIA = {
	Teacher: () => __('Teacher'),
	Learner: () => __('Learner'),
	'AI Engine': () => __('AI Engine'),
}

export function viaLabel(via) {
	return VIA[via] ? VIA[via]() : via || ''
}

const UNITS = {
	page: () => __('page'),
	slide: () => __('slide'),
	section: () => __('section'),
}

export function unitLabel(unit) {
	return UNITS[unit] ? UNITS[unit]() : unit || ''
}

const STATS = {
	learners: () => __('Learners'),
	questions: () => __('Questions'),
	submissions: () => __('Submissions'),
	approved_feedback: () => __('Approved feedback'),
}

export function statLabel(key) {
	return STATS[key] ? STATS[key]() : key
}

// ----------------------------------------------------------------- dates

// Frappe sends naive datetimes in the system time zone.
export function parseDate(value) {
	if (!value) return null
	const date = new Date(String(value).replace(' ', 'T'))
	return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
	const date = parseDate(value)
	if (!date) return ''
	return date.toLocaleString(document.documentElement.lang || undefined, {
		dateStyle: 'short',
		timeStyle: 'short',
	})
}

// Age of a server timestamp. `clockOffset` is server time minus browser time,
// so the age is measured against the server's clock rather than ours.
export function ago(value, clockOffset = 0, now = Date.now()) {
	const date = parseDate(value)
	if (!date) return ''
	const minutes = Math.max(
		0,
		Math.round((now + clockOffset - date.getTime()) / 60000)
	)
	if (minutes < 60) return __('{0} min').format(minutes)
	const hours = Math.round(minutes / 60)
	if (hours < 24) return __('{0} h').format(hours)
	return __('{0} d').format(Math.round(hours / 24))
}

// ----------------------------------------------------------------- errors

export function errorText(error) {
	const message = error?.messages?.length
		? error.messages.join(' ')
		: error?.message
	const text = htmlToText(message || '').trim()
	return text || __('Something went wrong. Please try again.')
}

// ----------------------------------------------------------------- github

export function repoParts(url) {
	const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(url || '')
	return match ? { owner: match[1], repo: match[2] } : null
}

export function githubLine(submission, citation) {
	const ref = submission.commit || 'HEAD'
	let url = `${submission.repo_url}/blob/${ref}/${citation.file}`
	if (citation.line_start) {
		url += `#L${citation.line_start}`
		if (citation.line_end > citation.line_start)
			url += `-L${citation.line_end}`
	}
	return url
}

export function rawFileUrl(submission, file) {
	const parts = repoParts(submission.repo_url)
	if (!parts) return null
	const encode = (part) => part.split('/').map(encodeURIComponent).join('/')
	return [
		'https://raw.githubusercontent.com',
		encode(parts.owner),
		encode(parts.repo),
		encode(submission.commit || 'HEAD'),
		encode(file),
	].join('/')
}

export function citationLabel(citation) {
	if (citation.label) return citation.label
	if (citation.file) {
		const name = citation.file.split('/').pop()
		const range =
			citation.line_end > citation.line_start
				? `–${citation.line_end}`
				: ''
		return `${name}:${citation.line_start}${range}`
	}
	return citation.lesson || ''
}

// Every file the draft cites, in the order the criteria cite them.
export function citedFiles(scores) {
	const files = []
	for (const score of scores || []) {
		for (const citation of score.citations || []) {
			if (citation.file && !files.includes(citation.file))
				files.push(citation.file)
		}
	}
	return files
}

export function citedRanges(scores, file) {
	const ranges = []
	for (const score of scores || []) {
		for (const citation of score.citations || []) {
			if (citation.file === file) {
				ranges.push([
					citation.line_start,
					citation.line_end || citation.line_start,
				])
			}
		}
	}
	return ranges
}

// Pass once every criterion is above the lowest level, as the reference screen did.
export function suggestedResult(levels) {
	return Object.values(levels).every((level) => level > 1) ? 'Pass' : 'Fail'
}

// ------------------------------------------------------------------ misc

export function diffLine(line) {
	const text = String(line.text || '').replace(/^[+-]\s?/, '')
	const sign =
		{ add: '+ ', del: '- ', skip: '  ', same: '  ' }[line.op] || '  '
	return sign + text
}

export function evidenceLabel(item) {
	if (typeof item === 'string') return item
	if (item && item.label) return item.label
	return JSON.stringify(item)
}
