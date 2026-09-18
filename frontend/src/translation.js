import { call, getLocal, saveLocal } from 'frappe-ui'
import { shallowRef } from 'vue'

const TRANSLATION_LOAD_TIMEOUT = 10_000
const messages = shallowRef()
let translationsPromise
let networkPromise

export default function translationPlugin(app) {
	// EditorJS sub-apps mount after main.js bootstraps and share this dictionary.
	app.config.globalProperties.__ = translate
	window.__ = translate
}

function translate(message) {
	let translatedMessages = messages.value || window.translatedMessages || {}
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

/** Load the cached dictionary before mount, then refresh it in the background. */
export function loadTranslations() {
	if (window.translatedMessages) {
		return Promise.resolve(window.translatedMessages)
	}
	if (translationsPromise) {
		return translationsPromise
	}

	// Keep dictionaries for different languages separate in the same browser.
	const cacheKey = JSON.stringify([
		'translations',
		document.documentElement.lang || 'en',
	])

	// Like the former createResource cache, use IndexedDB immediately and refresh
	// from the server. The request must outlive the startup timeout so a late
	// response can still populate translations and the cache.
	if (!networkPromise) {
		networkPromise = Promise.resolve()
			.then(() => call('lms.lms.api.get_translations'))
			.then((data) => {
				if (!isDictionary(data)) {
					throw new Error('Invalid translation response')
				}
				setTranslations(data)
				void saveLocal(cacheKey, data).catch((error) => {
					console.warn('Unable to cache translations.', error)
				})
				return data
			})
			.finally(() => {
				networkPromise = undefined
			})
	}

	const cached = Promise.resolve()
		.then(() => getLocal(cacheKey))
		.then((data) => {
			if (!isDictionary(data)) throw new Error('No cached translations')
			if (!window.translatedMessages) setTranslations(data)
			return data
		})

	let timeoutId
	const timeout = new Promise((resolve) => {
		timeoutId = window.setTimeout(() => {
			console.warn(
				'Translation startup timed out; using source messages.',
			)
			resolve({})
		}, TRANSLATION_LOAD_TIMEOUT)
	})
	const available = Promise.any([cached, networkPromise]).catch((error) => {
		console.warn(
			'Unable to load translations; using source messages.',
			error,
		)
		return {}
	})
	translationsPromise = Promise.race([available, timeout]).finally(() => {
		window.clearTimeout(timeoutId)
		translationsPromise = undefined
	})

	return translationsPromise
}

function isDictionary(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function setTranslations(value) {
	window.translatedMessages = value
	// Re-render translated Vue labels if a refresh finishes after startup.
	messages.value = value
}
