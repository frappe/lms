<template>
	<div class="flex items-center justify-between mb-5">
		<div class="text-lg font-semibold text-ink-gray-9">
			{{ __('Live Class') }}
		</div>
		<Button v-if="canCreateClass()" @click="openLiveClassModal">
			<template #prefix>
				<Plus class="h-4 w-4" />
			</template>
			<span>
				{{ __('Add') }}
			</span>
		</Button>
	</div>
	<div v-if="liveClasses.data?.length" class="grid grid-cols-2 gap-5">
		<div
			v-for="cls in liveClasses.data"
			class="flex flex-col border rounded-md h-full text-ink-gray-7 p-3"
		>
			<div class="font-semibold text-ink-gray-9 text-lg mb-1">
				{{ cls.title }}
			</div>
			<div class="short-introduction">
				{{ cls.description }}
			</div>
			<div class="space-y-3">
				<div class="flex items-center space-x-2">
					<Calendar class="w-4 h-4 stroke-1.5" />
					<span>
						{{ dayjs(cls.date).format('DD MMMM YYYY') }}
					</span>
				</div>
				<div class="flex items-center space-x-2">
					<Clock class="w-4 h-4 stroke-1.5" />
					<span>
						{{ formatTime(cls.time) }}
					</span>
				</div>
				<div
					v-if="cls.date >= dayjs().format('YYYY-MM-DD')"
					class="flex items-center space-x-2 text-ink-gray-9 mt-auto"
				>
					<a
						v-if="user.data?.is_moderator || user.data?.is_evaluator"
						:href="cls.start_url"
						target="_blank"
						class="w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
					>
						<Monitor class="h-4 w-4 stroke-1.5" />
						{{ __('Start') }}
					</a>
					<a
						:href="cls.join_url"
						target="_blank"
						class="w-full cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
					>
						<Video class="h-4 w-4 stroke-1.5" />
						{{ __('Join') }}
					</a>
				</div>
				<div v-else class="flex items-center space-x-2 text-yellow-700">
					<Info class="w-4 h-4 stroke-1.5" />
					<span>
						{{ __('This class has ended') }}
					</span>
				</div>
			</div>
		</div>
	</div>
	<div v-else class="text-sm italic text-ink-gray-5">
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
import { Plus, Clock, Calendar, Video, Monitor, Info } from 'lucide-vue-next'
import { inject } from 'vue'
import LiveClassModal from '@/components/Modals/LiveClassModal.vue'
import { ref } from 'vue'
import { formatTime } from '@/utils/'

const user = inject('$user')
const showLiveClassModal = ref(false)
const dayjs = inject('$dayjs')
const readOnlyMode = window.read_only_mode

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

const canCreateClass = () => {
	if (readOnlyMode) return false
	return user.data?.is_moderator || user.data?.is_evaluator
}
</script>
<style>
.short-introduction {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin: 0.25rem 0 1.5rem;
	line-height: 1.5;
}
</style>
