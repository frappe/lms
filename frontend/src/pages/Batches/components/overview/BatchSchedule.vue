<template>
	<section v-if="classes.length || editable || isPending">
		<div class="mb-4 flex items-baseline justify-between gap-4">
			<div class="flex items-center gap-1.5">
				<h2 class="text-3xl-semibold text-ink-gray-9">{{ __('Schedule') }}</h2>
				<Tooltip
					v-if="editable && !isPending && !classes.length"
					:text="__('Shown to enrolled learners once you add classes')"
				>
					<button
						type="button"
						class="inline-grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9"
						:aria-label="__('About the schedule')"
					>
						<span class="lucide-info size-4" aria-hidden="true" />
					</button>
				</Tooltip>
			</div>
			<SkeletonText
				v-if="isPending"
				text="text-p-base"
				width="w-24"
				class="w-24 motion-safe:animate-pulse"
				aria-hidden="true"
			/>
			<span v-else-if="classes.length" class="text-p-base text-ink-gray-6">
				{{ countLabel }}
			</span>
		</div>
		<OverviewListSkeleton
			v-if="isPending"
			data-testid="batch-schedule-skeleton"
			:rows="needsProvider ? 0 : SHOWN"
			row="schedule"
		/>
		<OverviewEmptyTile
			v-else-if="!classes.length"
			icon="lucide-calendar-plus"
			:title="emptyState.title"
			:description="emptyState.description"
		>
			<Button
				v-if="batchName && needsProvider"
				variant="subtle"
				:label="__('Open Settings')"
				@click="router.push({ ...route, hash: '#settings' })"
			/>
			<Button
				v-else-if="batchName"
				data-testid="schedule-add-class"
				variant="subtle"
				@click="openBatchForm(router, 'NewLiveClass', batchName, route.hash)"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Schedule a class') }}
			</Button>
		</OverviewEmptyTile>
		<ul
			v-else
			class="divide-y divide-outline-gray-1 overflow-hidden rounded-5 border border-outline-gray-2"
		>
			<li
				v-for="liveClass in nextClasses"
				:key="liveClass.name"
				class="flex items-center gap-4 px-4 py-2.5 text-p-base"
			>
				<span class="w-24 shrink-0 text-p-sm text-ink-gray-6">
					{{ dayjs(liveClass.date).format('ddd, D MMM') }}
				</span>
				<span class="min-w-0 flex-1 truncate text-ink-gray-8">
					{{ liveClass.title }}
				</span>
			</li>
			<li v-if="classes.length > nextClasses.length">
				<router-link
					:to="{ hash: '#classes' }"
					class="block px-4 py-2 text-p-sm text-ink-gray-6 hover:bg-surface-gray-1"
				>
					{{ __('Show all {0} classes').format(classes.length) }}
				</router-link>
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Tooltip, createListResource } from 'frappe-ui'
import { useRoute, useRouter } from 'vue-router'
import dayjs from '@/utils/dayjs'
import { openBatchForm } from '@/composables/useBatchForms'
import { injectBatchForm } from '@/pages/Batches/composables/useBatchForm'
import OverviewEmptyTile from '@/pages/Batches/components/overview/OverviewEmptyTile.vue'
import OverviewListSkeleton from '@/components/Skeletons/OverviewListSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

interface LiveClassRow {
	name: string
	title: string
	date: string
}

const SHOWN = 4

const route = useRoute()
const router = useRouter()
const form = injectBatchForm()

/** The batch's next live classes, with a link to the Classes tab. */
const props = defineProps<{
	/** Unset for a batch not saved yet, which has no classes. */
	batchName?: string
	/** Editors see the empty schedule; learners see nothing until classes exist. */
	editable?: boolean
}>()

const liveClasses = createListResource({
	doctype: 'LMS Live Class',
	filters: { batch_name: props.batchName },
	fields: ['name', 'title', 'date'],
	orderBy: 'date asc, time asc',
	pageLength: 500,
	auto: Boolean(props.batchName),
})

const classes = computed<LiveClassRow[]>(() => liveClasses.data || [])

const isPending = computed<boolean>(
	() =>
		Boolean(props.batchName) && liveClasses.list.loading && !liveClasses.data
)

// Upcoming first; once the batch is over, its last few.
const nextClasses = computed<LiveClassRow[]>(() => {
	const today = dayjs().format('YYYY-MM-DD')
	const upcoming = classes.value.filter((row) => row.date >= today)
	return upcoming.length
		? upcoming.slice(0, SHOWN)
		: classes.value.slice(-SHOWN)
})

// The same check as the Classes tab: a class needs a Zoom or Google Meet account.
const needsProvider = computed<boolean>(() => {
	const doc = form?.doc.value
	if (doc?.conferencing_provider === 'Zoom') return !doc.zoom_account
	if (doc?.conferencing_provider === 'Google Meet')
		return !doc.google_meet_account
	return true
})

const emptyState = computed(() =>
	props.batchName && needsProvider.value
		? {
				title: __('Set up live classes'),
				description: __(
					'Pick Zoom or Google Meet for this batch in Settings, then schedule classes your students join from here.'
				),
		  }
		: {
				title: __('No classes scheduled'),
				description: __(
					'Schedule a live class and learners get an invite with the joining link.'
				),
		  }
)

const countLabel = computed<string>(() =>
	classes.value.length === 1
		? __('1 live class')
		: __('{0} live classes').format(classes.value.length)
)
</script>
