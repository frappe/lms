import { createResource } from 'frappe-ui'
export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	// fetch translations

	if (!window.translatedMessages)
		fetchTranslations().then((translations) => {
			window.translatedMessages = translations
		})
}

async function translate(message) {
	let lang = window.lang || 'hi'
	let translatedMessage = /* window.translatedMessages[message] || */ message
	const hasPlaceholders = /{\d+}/.test(message)

	console.log(translatedMessage)
	console.log(hasPlaceholders)
	if (!hasPlaceholders) {
		return translatedMessage
	}
	return {
		format: function (...args) {
			return translatedMessage.replace(
				/{(\d+)}/g,
				function (match, number) {
					console.log(match, number)
					console.log(args[number])

					return typeof args[number] != 'undefined'
						? args[number]
						: match
				}
			)
		},
	}
}

async function fetchTranslations() {
	let lang = window.lang || 'hi'
	let translations = await createResource({
		url: 'lms.lms.api.get_translations',
		cache: 'translations',
		auto: true,
	})
	let translatedMessages = {}
	console.log(translations.data)
	translations.forEach((translation) => {
		translatedMessages[translation.source_text] =
			translation.translated_text
	})
	window.translatedMessages = translatedMessages
}
