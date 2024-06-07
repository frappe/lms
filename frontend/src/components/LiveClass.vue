<template>
	<Button
		v-if="user.data.is_moderator"
		variant="solid"
		class="float-right mb-5"
		@click="openLiveClassModal"
	>
		<template #prefix>
			<Plus class="h-4 w-4" />
		</template>
		<span>
			{{ __('Add Live Class') }}
		</span>
	</Button>
	<div class="text-lg font-semibold mb-5">
		{{ __('Live Class') }}
	</div>
	<div v-if="liveClasses.data?.length" class="grid grid-cols-2 gap-5">
		<div
			v-for="cls in liveClasses.data"
			class="flex flex-col border rounded-md h-full p-3"
		>
			<div class="font-semibold text-lg mb-4">
				{{ cls.title }}
			</div>
			<div class="mb-4">
				{{ cls.description }}
			</div>
			<div class="flex items-center mb-2">
				<Calendar class="w-4 h-4 stroke-1.5" />
				<span class="ml-2">
					{{ dayjs(cls.date).format('DD MMMM YYYY') }}
				</span>
			</div>
			<div class="flex items-center mb-5">
				<Clock class="w-4 h-4 stroke-1.5" />
				<span class="ml-2">
					{{ formatTime(cls.time) }}
				</span>
			</div>
			<div class="flex items-center space-x-2 mt-auto">
				<a
					:href="cls.start_url"
					target="_blank"
					class="w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded"
				>
					<Monitor class="h-4 w-4 stroke-1.5" />
					{{ __('Start') }}
				</a>
				<a
					:href="cls.join_url"
					target="_blank"
					class="w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded"
				>
					<Video class="h-4 w-4 stroke-1.5" />
					{{ __('Join') }}
				</a>
			</div>
		</div>
	</div>
	<div v-else class="text-sm italic text-gray-600">
		{{ __('No live classes scheduled') }}
	</div>
	<LiveClassModal
		:batch="props.batch"
		v-model="showLiveClassModal"
		v-model:reloadLiveClasses="liveClasses"
	/>
</template>
<script setup>
import { createListResource, Button } from 'frappe-ui'
import { Plus, Clock, Calendar, Video, Monitor } from 'lucide-vue-next'
import { inject } from 'vue'
import LiveClassModal from '@/components/Modals/LiveClassModal.vue'
import { ref } from 'vue'
import { formatTime } from '@/utils/'

const user = inject('$user')
const showLiveClassModal = ref(false)
const dayjs = inject('$dayjs')

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

const liveClasses = createListResource({
	doctype: 'LMS Live Class',
	filters: {
		batch_name: props.batch,
		date: ['>=', new Date()],
	},
	fields: [
		'title',
		'description',
		'time',
		'date',
		'start_url',
		'join_url',
		'owner',
	],
	orderBy: 'date',
	auto: true,
})

const openLiveClassModal = () => {
	showLiveClassModal.value = true
}
</script>
