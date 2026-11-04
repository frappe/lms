import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { useExerciseDraft } from '@/composables/useExerciseDraft'

// Guards the learner's code draft: keyed per exercise and user, never under ''.
// Came with this branch's autosave of the learner's in-progress code.
// Added on feat/assessment-visual-redesign so drafts never cross learners.
describe('useExerciseDraft', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('reads back what it saved under the exercise and user key', () => {
		const draft = useExerciseDraft(ref('two-sum'), ref('a@b.com'))
		draft.save('print(1)')

		expect(localStorage.getItem('lms:pe-draft:two-sum:a@b.com')).toBe(
			'print(1)'
		)
	})

	it('exposes an existing draft on creation', () => {
		localStorage.setItem('lms:pe-draft:two-sum:a@b.com', 'print(2)')

		const draft = useExerciseDraft(ref('two-sum'), ref('a@b.com'))

		expect(draft.draft.value).toBe('print(2)')
	})

	it('does not leak one learner draft into another', () => {
		useExerciseDraft(ref('two-sum'), ref('a@b.com')).save('mine')

		const other = useExerciseDraft(ref('two-sum'), ref('c@d.com'))

		expect(other.draft.value).toBeNull()
	})

	it('clear removes the key and drops the saved flag', () => {
		const draft = useExerciseDraft(ref('two-sum'), ref('a@b.com'))
		draft.save('print(1)')

		draft.clear()

		expect(localStorage.getItem('lms:pe-draft:two-sum:a@b.com')).toBeNull()
		expect(draft.saved.value).toBe(false)
	})

	it('survives a storage that throws', () => {
		const setItem = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('QuotaExceededError')
			})
		const draft = useExerciseDraft(ref('two-sum'), ref('a@b.com'))

		expect(() => draft.save('print(1)')).not.toThrow()
		expect(draft.saved.value).toBe(false)

		setItem.mockRestore()
	})

	// `user` is '' until the user resource lands. A write then would sit under
	// `lms:pe-draft:<exercise>:` for whoever mounts next in this browser.
	it('writes nothing while the user is unknown', () => {
		const draft = useExerciseDraft(ref('two-sum'), ref(''))

		draft.save('print(1)')

		expect(localStorage.getItem('lms:pe-draft:two-sum:')).toBeNull()
		expect(localStorage.length).toBe(0)
		expect(draft.saved.value).toBe(false)
		expect(draft.draft.value).toBeNull()
	})

	it('writes nothing while the exercise is unknown', () => {
		const draft = useExerciseDraft(ref(''), ref('a@b.com'))

		draft.save('print(1)')

		expect(localStorage.length).toBe(0)
		expect(draft.saved.value).toBe(false)
	})

	it('shows no draft left under an empty-user key by an older session', () => {
		localStorage.setItem('lms:pe-draft:two-sum:', 'someone else code')

		const draft = useExerciseDraft(ref('two-sum'), ref(''))

		expect(draft.draft.value).toBeNull()
	})

	it('starts saving once the user lands', async () => {
		const user = ref('')
		const draft = useExerciseDraft(ref('two-sum'), user)

		user.value = 'a@b.com'
		await nextTick()
		draft.save('print(1)')

		expect(localStorage.getItem('lms:pe-draft:two-sum:a@b.com')).toBe(
			'print(1)'
		)
		expect(draft.saved.value).toBe(true)
	})

	it('re-reads the draft when the exercise changes under it', async () => {
		localStorage.setItem('lms:pe-draft:two-sum:a@b.com', 'first exercise code')
		localStorage.setItem(
			'lms:pe-draft:palindrome:a@b.com',
			'second exercise code'
		)
		const exercise = ref('two-sum')
		const draft = useExerciseDraft(exercise, ref('a@b.com'))

		expect(draft.draft.value).toBe('first exercise code')

		exercise.value = 'palindrome'
		await nextTick()

		expect(draft.draft.value).toBe('second exercise code')
		expect(draft.saved.value).toBe(false)
	})
})
