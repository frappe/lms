import { createResource } from 'frappe-ui'

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
	if (!window.translatedMessages) fetchTranslations()
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

function fetchTranslations(lang) {
	createResource({
		url: 'lms.lms.api.get_translations',
		cache: 'translations',
		auto: true,
		transform: (data) => {
			window.translatedMessages = data
		},
	})
}
