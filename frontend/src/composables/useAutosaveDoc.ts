import { ref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

type Payload = Record<string, unknown>

export interface AutosaveDoc {
	saved: Ref<boolean>
	schedule: () => void
	flush: () => Promise<void>
}

// Writes a document as its content changes. `payload` returns null while there
// is nothing to write yet: a document that has not been created cannot be patched.
export function useAutosaveDoc(options: {
	payload: () => Payload | null
	save: (payload: Payload) => Promise<unknown>
	delay?: number
}): AutosaveDoc {
	const { payload, save, delay = 800 } = options

	const saved = ref(true)
	// Neither frappe-ui's debounce nor useDebounceFn has cancel(), so a stale
	// tick has to find itself stale by its token.
	let generation = 0
	let parked = false
	let chain: Promise<void> | null = null

	const send = async (): Promise<void> => {
		const body = payload()
		if (!body) return
		const serialized = JSON.stringify(body)
		try {
			await save(body)
			saved.value = JSON.stringify(payload()) === serialized
		} catch {
			saved.value = false
		}
	}

	const drain = async (): Promise<void> => {
		do {
			parked = false
			await send()
		} while (parked)
	}

	// An edit arriving mid-save is parked and sent when the save settles.
	const write = (): Promise<void> => {
		if (chain) {
			parked = true
			return chain
		}
		chain = drain().finally(() => {
			chain = null
		})
		return chain
	}

	const run = (token: number): Promise<void> | undefined => {
		if (token === generation) return write()
	}

	const debounced = useDebounceFn((token: number) => run(token), delay)

	const schedule = (): void => {
		saved.value = false
		debounced(++generation)
	}

	const flush = async (): Promise<void> => {
		generation++
		await write()
	}

	return { saved, schedule, flush }
}
