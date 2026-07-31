/**
 * `createResource({auto: true, debounce})` calls the *debounced* fetch, so
 * `loading` stays false for the whole debounce window. Keying the empty state
 * off `loading` alone told a correctly configured site that its Unsplash
 * integration was missing, for the first 500ms the picker was open.
 */
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'

type Resource = { data: unknown; loading: boolean }

/** The template's two conditions, as written in EditCoverImage.vue. */
function emptyState(images: Resource) {
	const hasImages = computed(
		() => (images.data as unknown[] | null)?.length > 0
	)
	const hasFetched = computed(
		() => images.data !== null && images.data !== undefined
	)
	return {
		showsGrid: () => hasImages.value,
		showsMessage: () => !hasImages.value && hasFetched.value && !images.loading,
	}
}

describe('cover-image picker empty state', () => {
	it('says nothing while the debounced fetch has not run yet', () => {
		// auto:true has fired but the debounce has not elapsed: no data, and
		// loading is still false because the debounced call has not started.
		const state = emptyState({ data: null, loading: false })

		expect(state.showsMessage()).toBe(false)
	})

	it('says nothing while the request is in flight', () => {
		expect(emptyState({ data: null, loading: true }).showsMessage()).toBe(false)
	})

	it('reports the integration as unavailable once an empty result comes back', () => {
		expect(emptyState({ data: [], loading: false }).showsMessage()).toBe(true)
	})

	it('shows the grid when there are images', () => {
		const state = emptyState({ data: [{ id: 'a' }], loading: false })

		expect(state.showsGrid()).toBe(true)
		expect(state.showsMessage()).toBe(false)
	})
})
