import { call } from 'frappe-ui'

const TRANSLATION_LOAD_TIMEOUT = 10_000
let translationsPromise

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
}

function translate(message) {
	let translatedMessages = window.translatedMessages || {}
	let translatedMessage = translatedMessages[message] || message

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

export function loadTranslations() {
	if (window.translatedMessages) {
		return Promise.resolve(window.translatedMessages)
	}
	if (translationsPromise) {
		return translationsPromise
	}

	translationsPromise = withTimeout(
		call('lms.lms.api.get_translations'),
		TRANSLATION_LOAD_TIMEOUT
	)
		.then((data) => {
			window.translatedMessages = data || {}
			return window.translatedMessages
		})
		.catch((error) => {
			console.warn('Unable to load translations; using source messages.', error)
			window.translatedMessages = {}
			return window.translatedMessages
		})

	return translationsPromise
}

function withTimeout(promise, timeout) {
	let timeoutId
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = window.setTimeout(() => {
			reject(new Error(`Translation request timed out after ${timeout}ms`))
		}, timeout)
	})

	return Promise.race([promise, timeoutPromise]).finally(() => {
		window.clearTimeout(timeoutId)
	})
}
