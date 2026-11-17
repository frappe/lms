import { ref } from 'vue'

// Bumped when the messages arrive, so templates that called `__()` re-render.
const messagesVersion = ref(0)

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
	messagesVersion.value
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
// A hung request must not leave the page blank; the app mounts in English and
// picks the messages up when they arrive.
const MOUNT_WAIT_MS = 3000

// Strings built in setup() are translated once, so main.js mounts the app only
// after the messages are in (or MOUNT_WAIT_MS has passed).
export function loadTranslations() {
	if (window.translatedMessages) return Promise.resolve()
	loading ||= waitForTranslations()
	return loading
}

function waitForTranslations() {
	const request = (window.lmsTranslations || fetchTranslations()).then(
		(messages) => {
			window.translatedMessages = messages
			messagesVersion.value++
		}
	)
	const timeout = new Promise((resolve) => setTimeout(resolve, MOUNT_WAIT_MS))
	return Promise.race([request, timeout])
}

// Fallback when index.html did not start the request (tests, other entries).
function fetchTranslations() {
	const lang = encodeURIComponent(document.documentElement.lang || '')
	return fetch(
		`/api/method/frappe.translate.get_boot_translations?lang=${lang}`,
		{
			credentials: 'same-origin',
			headers: { Accept: 'application/json' },
		}
	)
		.then((response) => (response.ok ? response.json() : {}))
		.then((data) => data.message || {})
		.catch((error) => {
			console.error('Could not load translations', error)
			return {}
		})
}
