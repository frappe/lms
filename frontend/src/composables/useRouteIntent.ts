import { ref, watch, type WatchSource } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface RouteIntent {
	param: string
	value: string
	ready: WatchSource<unknown>
	run: () => void
	flush?: 'pre' | 'post'
}

// A one-shot request in the URL, like onboarding's ?pricing=paid. The param is
// dropped once read, so a refresh or a later visit does nothing, and `run`
// waits until `ready` is truthy.
export function useRouteIntent(intent: RouteIntent): void {
	const route = useRoute()
	const router = useRouter()
	const requested = ref<boolean>(false)

	watch(
		() => route.query[intent.param],
		(given) => {
			if (given !== intent.value) return
			requested.value = true
			const { [intent.param]: _dropped, ...query } = route.query
			router.replace({ query, hash: route.hash })
		},
		{ immediate: true }
	)

	watch(
		[requested, intent.ready],
		([wanted, isReady]) => {
			if (!wanted || !isReady) return
			requested.value = false
			intent.run()
		},
		{ immediate: true, flush: intent.flush ?? 'pre' }
	)
}
