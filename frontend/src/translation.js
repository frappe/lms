import { createResource } from 'frappe-ui'

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	console.log(window.translatedMessages)
	if (!window.translatedMessages) fetchTranslations()
}

function translate(message) {
	let lang = window.lang || 'hi'
	let translatedMessages = window.translatedMessages || {
		'All Courses': 'सभी पाठ्यक्रम',
		Live: 'लाइव',
	}
	let translatedMessage = translatedMessages[message] || message
	const hasPlaceholders = /{\d+}/.test(message)
	console.log(hasPlaceholders)
	if (!hasPlaceholders) {
		console.log(translatedMessage)
		return translatedMessage
	}
	return {
		format: function (...args) {
			return translatedMessage.replace(
				/{(\d+)}/g,
				function (match, number) {
					return typeof args[number] != 'undefined'
						? args[number]
						: match
				}
			)
		},
	}
}

function fetchTranslations(lang) {
	console.log('called')
	createResource({
		url: 'lms.lms.api.get_translations',
		cache: 'translations',
		auto: true,
		transform: (data) => {
			console.log(data)
			window.translatedMessages = data.message
		},
	})
}
