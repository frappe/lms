import { createResource } from 'frappe-ui'
import { shallowRef } from 'vue'

const translatedMessages = shallowRef(window.translatedMessages || {})

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
	if (window.translatedMessages) {
		translatedMessages.value = window.translatedMessages
	} else {
		fetchTranslations()
	}
}

function translate(message) {
	let translatedMessage = translatedMessages.value[message] || message

	const hasPlaceholders = /{\d+}/.test(message)
	if (!hasPlaceholders) {
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

function fetchTranslations() {
	createResource({
		url: 'lms.lms.api.get_translations',
		cache: 'translations',
		auto: true,
		transform: (data) => {
			window.translatedMessages = data
			translatedMessages.value = data
		},
	})
}
