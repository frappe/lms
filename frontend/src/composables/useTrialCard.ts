import type { BillingTrial } from '@frappe/cloud-sdk'
import { getBilling } from '@frappe/cloud-sdk/api'
import { computed, ref, watch, type ComputedRef } from 'vue'
import { hasCloudSettings } from '@/composables/cloudSettings'

interface CachedTrial {
	trial: BillingTrial | null
	fetchedAt: number
}

const CACHE_MS = 6 * 60 * 60 * 1000
const DISMISS_MS = 24 * 60 * 60 * 1000
const CACHE_KEY = 'lms-trial-card'
const DISMISS_KEY = 'lms-trial-card-dismissed-at'

function readCache(): CachedTrial | null {
	try {
		return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
	} catch {
		return null
	}
}

const isFresh = (cached: CachedTrial | null): boolean =>
	!!cached && Date.now() - cached.fetchedAt < CACHE_MS

async function loadTrial(): Promise<BillingTrial | null> {
	const { trial } = await getBilling()
	const cached: CachedTrial = { trial: trial ?? null, fetchedAt: Date.now() }
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
	} catch {
		// storage blocked, the next load fetches again
	}
	return cached.trial
}

// Overlapping callers share one request
let pending: Promise<BillingTrial | null> | null = null
function fetchTrial(): Promise<BillingTrial | null> {
	pending ??= loadTrial().finally(() => (pending = null))
	return pending
}

function isDismissed(): boolean {
	try {
		return (
			Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS
		)
	} catch {
		return false
	}
}

// Shared, so Settings can refresh it while no card is mounted
const trial = ref<BillingTrial | null>(null)
// Once billing has answered, the cache can only be as new, or older
let fetched = false

// A stale trial stays on screen if the refresh fails
export function refreshTrial(): Promise<void> {
	if (!hasCloudSettings()) return Promise.resolve()
	return fetchTrial()
		.then((value) => {
			trial.value = value
			fetched = true
		})
		.catch(() => {})
}

export function useTrialCard(): {
	trial: ComputedRef<BillingTrial | null>
	dismiss: () => void
} {
	// The user info that carries this loads after the sidebar mounts
	const enabled = computed(hasCloudSettings)
	const cached = readCache()
	if (cached && !fetched) trial.value = cached.trial
	const dismissed = ref(isDismissed())

	watch(
		enabled,
		(on) => {
			if (on && !isFresh(cached)) refreshTrial()
		},
		{ immediate: true }
	)

	function dismiss(): void {
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now()))
		} catch {
			// storage blocked, the card stays hidden until the next load
		}
		dismissed.value = true
	}

	// An ended trial cannot be dismissed
	const visibleTrial = computed(() => {
		if (!enabled.value || !trial.value) return null
		if (dismissed.value && trial.value.state !== 'Ended') return null
		return trial.value
	})

	return { trial: visibleTrial, dismiss }
}
