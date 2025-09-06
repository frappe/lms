<template>
	<div
		v-if="hasPermission() && !props.zoomAccount"
		class="flex items-center space-x-2 mb-5 bg-surface-amber-1 py-1 px-2 rounded-md text-ink-amber-3"
	>
		<AlertCircle class="size-4 stroke-1.5" />
		<span>
			{{ __('Please add a zoom account to the batch to create live classes.') }}
		</span>
	</div>

	<div class="flex items-center justify-between">
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
	<div
		v-if="liveClasses.data?.length"
		class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5"
	>
		<div
			v-for="cls in liveClasses.data"
			class="flex flex-col border rounded-md h-full text-ink-gray-7 hover:border-outline-gray-3 p-3"
			:class="{
				'cursor-pointer': hasPermission() && cls.attendees > 0,
			}"
			@click="
				() => {
					openAttendanceModal(cls)
				}
			"
		>
			<div class="font-semibold text-ink-gray-9 text-lg mb-1">
				{{ cls.title }}
			</div>
			<div class="short-introduction">
				{{ cls.description }}
			</div>
			<div class="mt-auto space-y-3">
				<div class="flex items-center space-x-2">
					<Calendar class="w-4 h-4 stroke-1.5" />
					<span>
						{{ dayjs(cls.date).format('DD MMMM YYYY') }}
					</span>
				</div>
				<div class="flex items-center space-x-2">
					<Clock class="w-4 h-4 stroke-1.5" />
					<span>
						{{ formatTime(cls.time) }} -
						{{ dayjs(getClassEnd(cls)).format('HH:mm A') }}
					</span>
				</div>
				<div
					v-if="canAccessClass(cls)"
					class="flex items-center space-x-2 text-ink-gray-9 mt-auto"
				>
					<a
						v-if="user.data?.is_moderator || user.data?.is_evaluator"
						:href="cls.start_url"
						target="_blank"
						class="cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
						:class="cls.join_url ? 'w-full' : 'w-1/2'"
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
				<Tooltip
					v-else-if="hasClassEnded(cls)"
					:text="__('This class has ended')"
					placement="right"
				>
					<div class="flex items-center space-x-2 text-ink-amber-3 w-fit">
						<Info class="w-4 h-4 stroke-1.5" />
						<span>
							{{ __('Ended') }}
						</span>
					</div>
				</Tooltip>
			</div>
		</div>
	</div>
	<div v-else class="text-sm italic text-ink-gray-5 mt-2">
		{{ __('No live classes scheduled') }}
	</div>

	<LiveClassModal
		:batch="props.batch"
		:zoomAccount="props.zoomAccount"
		v-model="showLiveClassModal"
		v-model:reloadLiveClasses="liveClasses"
	/>

	<LiveClassAttendance v-model="showAttendance" :live_class="attendanceFor" />
</template>
<script setup>
import { createListResource, Button, Tooltip } from 'frappe-ui'
import {
	Plus,
	Clock,
	Calendar,
	Video,
	Monitor,
	Info,
	AlertCircle,
} from 'lucide-vue-next'
import { inject, ref } from 'vue'
import { formatTime } from '@/utils/'
import LiveClassModal from '@/components/Modals/LiveClassModal.vue'
import LiveClassAttendance from '@/components/Modals/LiveClassAttendance.vue'

const user = inject('$user')
const showLiveClassModal = ref(false)
const dayjs = inject('$dayjs')
const readOnlyMode = window.read_only_mode
const showAttendance = ref(false)
const attendanceFor = ref(null)

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
	zoomAccount: String,
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
		'duration',
		'attendees',
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
	if (!props.zoomAccount) return false
	return hasPermission()
}

const hasPermission = () => {
	return user.data?.is_moderator || user.data?.is_evaluator
}

const canAccessClass = (cls) => {
	if (cls.date < dayjs().format('YYYY-MM-DD')) return false
	if (cls.date > dayjs().format('YYYY-MM-DD')) return false
	if (hasClassEnded(cls)) return false
	return true
}

const getClassEnd = (cls) => {
	const classStart = new Date(`${cls.date}T${cls.time}`)
	return new Date(classStart.getTime() + cls.duration * 60000)
}

const hasClassEnded = (cls) => {
	const classEnd = getClassEnd(cls)
	const now = new Date()
	return now > classEnd
}

const openAttendanceModal = (cls) => {
	if (!hasPermission()) return
	if (cls.attendees <= 0) return
	showAttendance.value = true
	attendanceFor.value = cls
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
