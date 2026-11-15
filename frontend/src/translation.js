import { call } from 'frappe-ui'

// Set on import, so module-scope `__()` calls in later imports don't throw.
window.__ = translate

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	loadTranslations()
}

function fill(message, args) {
	return message.replace(/{(\d+)}/g, function (match, number) {
		return typeof args[number] != 'undefined' ? args[number] : match
	})
}

// LMS calls __('Hello {0}').format(name). Frappe's shared UI calls it the
// Desk way, __('Hello {0}', [name]), and needs a string back.
function translate(message, replace) {
	let translatedMessages = window.translatedMessages || {}
	let translatedMessage = translatedMessages[message] || message

	if (Array.isArray(replace)) return fill(translatedMessage, replace)

	const hasPlaceholders = /{\d+}/.test(message)
	if (!hasPlaceholders) {
		return translatedMessage
	}
	return {
		format: function (...args) {
			return fill(translatedMessage, args)
		},
	}
}

let loading = null

// Strings built in setup() are translated once, so main.js mounts the app only
// after the messages are in.
export function loadTranslations() {
	if (window.translatedMessages) return Promise.resolve()
	loading ||= fetchTranslations()
	return loading
}

async function fetchTranslations() {
	try {
		window.translatedMessages = await call('lms.lms.api.get_translations')
	} catch (error) {
		console.error('Could not load translations', error)
	}
}
