import { computed, ref, watch, type Ref } from 'vue'

const keyFor = (exercise: string, user: string) =>
	`lms:pe-draft:${exercise}:${user}`

export function useExerciseDraft(exercise: Ref<string>, user: Ref<string>) {
	// No key until the user is known: a key with an empty user would hand one
	// learner's draft to the next person on a shared machine.
	const key = computed(() =>
		exercise.value && user.value ? keyFor(exercise.value, user.value) : null
	)
	const saved = ref(false)

	const read = (): string | null => {
		if (!key.value) return null
		try {
			return localStorage.getItem(key.value)
		} catch {
			return null
		}
	}

	const draft = ref<string | null>(read())

	// exerciseID (and, in principle, the signed-in user) can change on a
	// mounted page without the component remounting - re-read under the new
	// key so the draft shown always matches what `key` currently points at.
	watch(key, () => {
		draft.value = read()
		saved.value = false
	})

	const save = (code: string) => {
		if (!key.value) {
			saved.value = false
			return
		}
		try {
			localStorage.setItem(key.value, code)
			draft.value = code
			saved.value = true
		} catch {
			saved.value = false
		}
	}

	const clear = () => {
		if (key.value) {
			try {
				localStorage.removeItem(key.value)
			} catch {
				// a storage that refuses to remove is one that refused to write
			}
		}
		draft.value = null
		saved.value = false
	}

	return { draft, save, clear, saved }
}
