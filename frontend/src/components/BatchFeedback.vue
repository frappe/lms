<template>
	<div v-if="user.data?.is_student">
		<div
			v-if="feedbackList.data?.length"
			class="bg-surface-blue-2 text-blue-700 p-2 rounded-md mb-5"
		>
			{{ __('Thank you for providing your feedback!') }}
		</div>
		<div v-else class="flex justify-between items-center mb-5">
			<div class="text-lg font-semibold">
				{{ __('Help Us Improve') }}
			</div>
			<Button @click="submitFeedback()">
				{{ __('Submit') }}
			</Button>
		</div>
		<div class="space-y-8">
			<div class="flex items-center justify-between">
				<Rating
					v-for="key in ratingKeys"
					v-model="feedback[key]"
					:label="__(convertToTitleCase(key))"
					:readonly="readOnly"
				/>
			</div>
			<FormControl
				v-model="feedback.feedback"
				type="textarea"
				:label="__('Feedback')"
				:rows="7"
				:readonly="readOnly"
			/>
		</div>
	</div>

	<div v-else-if="feedbackList.data?.length">
		<div class="text-lg font-semibold mb-5">
			{{ __('Average of Feedback Received') }}
		</div>

		<div class="flex items-center justify-between mb-10">
			<Rating
				v-for="key in ratingKeys"
				v-model="average[key]"
				:label="__(convertToTitleCase(key))"
				:readonly="true"
			/>
		</div>

		<div class="text-lg font-semibold mb-5">
			{{ __('All Feedback') }}
		</div>
		<ListView
			:columns="feedbackColumns"
			:rows="feedbackList.data"
			row-key="name"
			:options="{
				showTooltip: false,
				rowHeight: 'h-16',
				selectable: false,
			}"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
			></ListHeader>
			<ListRows>
				<ListRow
					:row="row"
					v-for="row in feedbackList.data"
					class="group cursor-pointer feedback-list"
				>
					<template #default="{ column, item }">
						<ListRowItem
							:item="row[column.key]"
							:align="column.align"
							class="text-sm"
						>
							<template #prefix>
								<div v-if="column.key == 'member_name'">
									<Avatar
										class="flex"
										:image="row['member_image']"
										:label="item"
										size="sm"
									/>
								</div>
							</template>
							<div v-if="ratingKeys.includes(column.key)">
								<Rating v-model="row[column.key]" :readonly="true" />
							</div>
							<div v-else class="leading-5">
								{{ row[column.key] }}
							</div>
						</ListRowItem>
					</template>
				</ListRow>
			</ListRows>
		</ListView>
	</div>
	<div v-else class="text-sm italic text-center text-ink-gray-7 mt-5">
		{{ __('No feedback received yet.') }}
	</div>
</template>
<script setup>
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { convertToTitleCase } from '@/utils'
import {
	Avatar,
	Button,
	createListResource,
	FormControl,
	ListView,
	ListHeader,
	ListRows,
	ListRow,
	ListRowItem,
	Rating,
} from 'frappe-ui'

const user = inject('$user')
const ratingKeys = ['content', 'instructors', 'value']
const readOnly = ref(false)
const average = reactive({})
const feedback = reactive({})

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	let filters = {
		batch: props.batch,
	}
	if (user.data?.is_student) {
		filters['member'] = user.data?.name
	}
	feedbackList.update({
		filters: filters,
	})
	feedbackList.reload()
})

const feedbackList = createListResource({
	doctype: 'LMS Batch Feedback',
	filters: {
		batch: props.batch,
	},
	fields: [
		'content',
		'instructors',
		'value',
		'feedback',
		'name',
		'member',
		'member_name',
		'member_image',
	],
	cache: ['feedbackList', props.batch, user.data?.name],
})

watch(
	() => feedbackList.data,
	() => {
		if (feedbackList.data.length) {
			let data = feedbackList.data
			readOnly.value = true

			ratingKeys.forEach((key) => {
				average[key] = 0
			})

			data.forEach((row) => {
				Object.keys(row).forEach((key) => {
					if (ratingKeys.includes(key)) row[key] = row[key] * 5
					feedback[key] = row[key]
				})
				ratingKeys.forEach((key) => {
					average[key] += row[key]
				})
			})
			Object.keys(average).forEach((key) => {
				average[key] = average[key] / data.length
			})
		}
	}
)

const submitFeedback = () => {
	ratingKeys.forEach((key) => {
		feedback[key] = feedback[key] / 5
	})
	feedbackList.insert.submit(
		{
			member: user.data?.name,
			batch: props.batch,
			...feedback,
		},
		{
			onSuccess: () => {
				feedbackList.reload()
			},
		}
	)
}

const feedbackColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member_name',
			width: '10rem',
		},
		{
			label: 'Feedback',
			key: 'feedback',
			width: '15rem',
		},
		{
			label: 'Content',
			key: 'content',
			width: '9rem',
		},
		{
			label: 'Instructors',
			key: 'instructors',
			width: '9rem',
		},
		{
			label: 'Value',
			key: 'value',
			width: '9rem',
		},
	]
})
</script>
<style>
.feedback-list > button > div {
	align-items: start;
	padding: 0.15rem 0;
}
</style>
