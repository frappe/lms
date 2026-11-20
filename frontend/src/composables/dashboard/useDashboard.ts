import {
	inject,
	onBeforeUnmount,
	onScopeDispose,
	provide,
	ref,
	shallowRef,
	toValue,
	watchEffect,
} from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import { resourceErrorMessage } from '@/utils/resource'
import { fetchAnalyticsPreview } from '@/utils/dashboard/export'
import type {
	AnalyticsFormat,
	AnalyticsKind,
	AnalyticsPreview,
	AnalyticsWindow,
} from '@/types'

export type DashboardState = 'loading' | 'empty' | 'ready' | 'failed'

const KEY = 'dashboardState'

export const provideDashboardState = (): Ref<DashboardState> => {
	const state = ref<DashboardState>('loading')
	provide(KEY, state)
	return state
}

// The page header shows the dashboard's actions only once the dashboard says
// it has students. Reset before unmount: a keyed remount sets up the next
// dashboard before the old one's onUnmounted would run.
export const syncDashboardState = (current: () => DashboardState): void => {
	const state = inject<Ref<DashboardState> | null>(KEY, null)
	if (!state) return
	watchEffect(() => (state.value = current()))
	onBeforeUnmount(() => (state.value = 'loading'))
}

export function useStudentReminder(url: string) {
	const reminder = createResource<{ sent_to: string }>({ url })

	const sendReminder = (params: Record<string, string>): void => {
		reminder.submit(params).then(
			(result: { sent_to: string } | null) =>
				toast.success(__('Reminder sent to {0}').format(result?.sent_to ?? '')),
			(error: unknown) =>
				toast.error(
					resourceErrorMessage(error, __('Could not send the reminder'))
				)
		)
	}

	return { reminder, sendReminder }
}

// A keyboard cursor over a chart frappe-ui draws without one, e.g. the funnel:
// one tab stop, the arrows walk the steps, Enter or Space picks the one under
// the cursor. Leaving the chart drops the cursor.
export const useStepCursor = (
	count: Ref<number>,
	onPick: (index: number) => void
) => {
	const cursor = ref<number | null>(null)

	const move = (to: number): void => {
		cursor.value = Math.min(Math.max(to, 0), count.value - 1)
	}

	const onKeydown = (event: KeyboardEvent): void => {
		// Keys pressed on a control inside the chart, e.g. its view switch, are
		// that control's.
		if (event.target !== event.currentTarget) return
		if (!count.value || event.altKey || event.metaKey || event.ctrlKey) return
		const at = cursor.value
		const rtl = document.documentElement.dir === 'rtl'
		const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
		const back = rtl ? 'ArrowRight' : 'ArrowLeft'
		if (event.key === forward || event.key === 'ArrowDown')
			move(at === null ? 0 : at + 1)
		else if (event.key === back || event.key === 'ArrowUp')
			move(at === null ? count.value - 1 : at - 1)
		else if (event.key === 'Home') move(0)
		else if (event.key === 'End') move(count.value - 1)
		else if ((event.key === 'Enter' || event.key === ' ') && at !== null)
			onPick(at)
		else return
		event.preventDefault()
	}

	const onBlur = (): void => {
		cursor.value = null
	}

	return { cursor, onKeydown, onBlur }
}

// Long enough to reopen the dialog or flip between formats for free, short
// enough that a new enrollment shows up.
const CACHE_MS = 5 * 60 * 1000

interface CachedPreview {
	preview: AnalyticsPreview
	expires: number
}

export function useAnalyticsPreview(
	kind: MaybeRefOrGetter<AnalyticsKind>,
	name: MaybeRefOrGetter<string>,
	format: MaybeRefOrGetter<AnalyticsFormat>,
	timeWindow: MaybeRefOrGetter<AnalyticsWindow | null>
) {
	const preview = shallowRef<AnalyticsPreview | null>(null)
	const loading = ref<boolean>(false)
	const error = ref<string>('')
	// The failure itself, so the pane can tell offline from a server error.
	const failure = shallowRef<Error | null>(null)

	const cache = new Map<string, CachedPreview>()
	let latest = 0
	let timer: ReturnType<typeof setTimeout> | undefined

	async function fetchLatest(
		request: number,
		key: string,
		chosen: AnalyticsWindow
	): Promise<void> {
		try {
			const reply = await fetchAnalyticsPreview(
				toValue(kind),
				toValue(name),
				toValue(format),
				chosen
			)
			remember(key, reply)
			if (request === latest) preview.value = reply
		} catch (reason) {
			if (request === latest) {
				error.value = reason instanceof Error ? reason.message : String(reason)
				failure.value = reason instanceof Error ? reason : null
			}
		} finally {
			if (request === latest) loading.value = false
		}
	}

	function remember(key: string, reply: AnalyticsPreview): void {
		const now = Date.now()
		for (const [entry, cached] of cache) {
			if (cached.expires <= now) cache.delete(entry)
		}
		cache.set(key, { preview: reply, expires: now + CACHE_MS })
	}

	// Every call makes a reply still on its way stale.
	function cancel(): void {
		latest += 1
		clearTimeout(timer)
		preview.value = null
		loading.value = false
		error.value = ''
		failure.value = null
	}

	function load(delay = 0): void {
		cancel()
		const chosen = toValue(timeWindow)
		if (!chosen) return
		const key = JSON.stringify([
			toValue(kind),
			toValue(name),
			toValue(format),
			chosen,
		])
		const cached = cache.get(key)
		if (cached && cached.expires > Date.now()) {
			preview.value = cached.preview
			return
		}
		loading.value = true
		const request = latest
		if (delay)
			timer = setTimeout(() => fetchLatest(request, key, chosen), delay)
		else fetchLatest(request, key, chosen)
	}

	onScopeDispose(cancel)

	return { preview, loading, error, failure, load, cancel }
}
