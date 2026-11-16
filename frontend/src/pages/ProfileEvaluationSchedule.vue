<template>
	<div class="mt-7 mb-20">
		<div
			v-if="loadError"
			class="rounded-6 border border-outline-gray-2"
			data-testid="schedule-error"
		>
			<EmptyStateLayout
				:name="__('Evaluations')"
				icon="lucide-calendar-x-2"
				width="lg"
				:title="__('Could not load evaluations')"
				:description="__('The request did not get through. Try again.')"
			>
				<Button
					variant="subtle"
					:loading="evaluations.list?.loading"
					@click="retryLoad"
				>
					<span class="text-p-base">{{ __('Retry') }}</span>
				</Button>
			</EmptyStateLayout>
		</div>
		<div
			v-else-if="evaluations.list?.fetched && !evaluations.data?.length"
			class="rounded-6 border border-outline-gray-2"
			data-testid="empty-schedule"
		>
			<EmptyStateLayout
				:name="__('Evaluations')"
				icon="lucide-calendar-check"
				width="lg"
				:title="__('No evaluations yet')"
				:description="emptyDescription"
			/>
		</div>
		<div v-else class="flex h-dvh flex-col overflow-hidden">
			<Calendar
				v-if="evaluations.data?.length"
				:config="calendarConfig"
				:events="evaluations.data"
				@click="(event) => openEvent(event)"
			>
				<template #header="{ currentMonthYear, decrement, increment }">
					<div class="mb-2 flex justify-between">
						<span class="text-lg-semibold text-ink-gray-9">
							{{ currentMonthYear }}
						</span>
						<div class="flex gap-x-1">
							<Button
								@click="decrement()"
								variant="ghost"
								icon="lucide-chevron-left"
								:label="__('Previous')"
							/>
							<Button
								@click="increment()"
								variant="ghost"
								icon="lucide-chevron-right"
								:label="__('Next')"
							/>
						</div>
					</div>
				</template>
			</Calendar>
		</div>
	</div>
	<Event v-model="showEvent" :event="currentEvent" />
</template>
<script setup>
import { createListResource, Button } from 'frappe-ui'
import { Calendar } from 'frappe-ui/experimental'
import { computed, inject, ref } from 'vue'
import Event from '@/components/Modals/Event.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

// #header hides the view switcher, so m/w/d would leave Week with no way back.
const calendarConfig = { defaultMode: 'Week', enableShortcuts: false }

const user = inject('$user')
const currentEvent = ref(null)
const showEvent = ref(false)

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const evaluations = createListResource({
	doctype: 'LMS Certificate Request',
	filters: {
		evaluator: props.profile.data?.name,
		status: ['!=', 'Cancelled'],
	},
	fields: [
		'name',
		'member_name',
		'member',
		'course',
		'course_title',
		'batch_name',
		'batch_title',
		'evaluator',
		'evaluator_name',
		'date',
		'start_time',
		'end_time',
		'timezone',
		'google_meet_link',
	],
	auto: true,
	orderBy: 'creation desc',
	pageLength: 500,
	cache: ['schedule', user.data?.name],
	transform(data) {
		return data.map((d) => {
			let mappedData = Object.assign({}, d)

			mappedData.title = `${d.member_name}'s Evaluation`
			mappedData.participant = d.member_name
			mappedData.id = d.name
			mappedData.venue = d.google_meet_link
			mappedData.fromDate = `${d.date}`
			mappedData.toDate = `${d.date}`
			mappedData.fromTime = d.start_time
			mappedData.toTime = d.end_time
			mappedData.color = 'green'

			return mappedData
		})
	},
})

// Cached rows still beat an error, so only an empty failed load shows one.
const loadError = computed(
	() => Boolean(evaluations.list?.error) && !evaluations.data?.length
)
// The error state already shows the failure.
const retryLoad = () => evaluations.reload().catch(() => {})

const emptyDescription = computed(() =>
	props.profile.data?.name === user.data?.name
		? __('Evaluations students book with you will show up here.')
		: __('Evaluations students book with this evaluator will show up here.')
)

const openEvent = (event) => {
	currentEvent.value = event.calendarEvent
	showEvent.value = true
}
</script>
