import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useFlowDocked } from '@/composables/useFlowDocked'

const SIDE_PANELS_BESIDE =
	'lg:@5xl:flex-1 @5xl:grid-cols-[minmax(0,1fr)_22rem] @[73.5rem]:grid-cols-[minmax(0,1fr)_26rem] @7xl:grid-cols-[minmax(0,1fr)_30rem]'
const KPIS_BESIDE_SIDE_PANELS = '@5xl:grid-cols-2 @[73.5rem]:grid-cols-4'

/**
 * Side panels sit beside the student list only on a wide container with Flow
 * closed; while Flow is docked they always stack below it. Only the side by
 * side grid fills the page height; stacked, it keeps its natural height.
 */
export function useDashboardColumns(): {
	gridClass: ComputedRef<string>
	kpiClass: ComputedRef<string>
} {
	const isFlowDocked = useFlowDocked()
	return {
		gridClass: computed(() => (isFlowDocked.value ? '' : SIDE_PANELS_BESIDE)),
		kpiClass: computed(() =>
			isFlowDocked.value ? '' : KPIS_BESIDE_SIDE_PANELS
		),
	}
}
