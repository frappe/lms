<template>
	<div class="mt-7 mb-20">
		<div class="flex h-screen flex-col overflow-hidden">
			<Calendar
				v-if="evaluations.data?.length"
				:config="{
					defaultMode: 'Month',
					disableModes: ['Day', 'Week'],
					redundantCellHeight: 100,
					enableShortcuts: false,
				}"
				:events="evaluations.data"
				@click="(event) => openEvent(event)"
			>
				<template #header="{ currentMonthYear, decrement, increment }">
					<div class="mb-2 flex justify-between">
						<span class="text-lg text-ink-gray-9 font-semibold">
							{{ currentMonthYear }}
						</span>
						<div class="flex gap-x-1">
							<Button
								@click="decrement()"
								variant="ghost"
								class="h-4 w-4"
								icon="chevron-left"
							/>
							<Button
								@click="increment()"
								variant="ghost"
								class="h-4 w-4"
								icon="chevron-right"
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
import { Calendar, createListResource, Button } from 'frappe-ui'
import { inject, ref } from 'vue'
import Event from '@/components/Modals/Event.vue'

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
		evaluator: user.data?.name,
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
		'google_meet_link',
	],
	auto: true,
	orderBy: 'creation desc',
	limit: 100,
	cache: ['schedule', user.data?.name],
	transform(data) {
		return data.map((d) => {
			let mappedData = Object.assign({}, d)

			mappedData.title = `${d.member_name}'s Evaluation`
			mappedData.participant = d.member_name
			mappedData.id = d.name
			mappedData.venue = d.google_meet_link
			mappedData.fromDate = `${d.date} ${d.start_time}`
			mappedData.toDate = `${d.date} ${d.end_time}`
			mappedData.color = 'green'

			return mappedData
		})
	},
})

const openEvent = (event) => {
	currentEvent.value = event.calendarEvent
	showEvent.value = true
}
</script>
