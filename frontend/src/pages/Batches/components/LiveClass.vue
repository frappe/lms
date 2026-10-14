<template>
	<div class="p-5">
		<Alert
			v-if="canManageClasses() && !hasProviderAccount()"
			theme="amber"
			class="mb-5"
			:title="__('No conferencing account')"
			:description="
				__(
					'Please select a conferencing provider and add an account to the batch to create live classes.'
				)
			"
		/>

		<div class="flex items-center justify-between">
			<div class="text-lg-semibold text-ink-gray-9">
				{{ __('Live Class') }}
			</div>
			<Button
				v-if="canCreateClass()"
				data-testid="live-class-add"
				@click="openLiveClassForm"
			>
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				<span>
					{{ __('Add') }}
				</span>
			</Button>
		</div>
		<div
			v-if="liveClasses.data?.length"
			class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5"
		>
			<div
				v-for="cls in liveClasses.data"
				:key="cls.name"
				class="flex flex-col border rounded-5 h-full text-ink-gray-7 hover:border-outline-gray-3 p-3"
				:class="{
					'cursor-pointer': isAdmin() && cls.attendees > 0,
				}"
				@click="
					() => {
						openAttendanceModal(cls)
					}
				"
			>
				<div class="font-semibold text-ink-gray-9 mb-1">
					{{ cls.title }}
				</div>
				<div class="short-introduction">
					{{ cls.description }}
				</div>
				<div class="mt-auto space-y-3">
					<div class="flex items-center gap-x-2">
						<span class="lucide-calendar w-4 h-4" />
						<span>
							{{ dayjs(cls.date).format('DD MMMM YYYY') }}
						</span>
					</div>
					<div class="flex items-center gap-x-2">
						<span class="lucide-clock w-4 h-4" />
						<span>
							{{ dayjs(getClassStart(cls)).format('hh:mm A') }} -
							{{ dayjs(getClassEnd(cls)).format('hh:mm A') }}
						</span>
					</div>
					<div
						v-if="canManageClasses() && cls.invite_status === 'Failed'"
						class="flex items-center justify-between gap-2"
					>
						<div class="flex items-center gap-x-2 text-ink-amber-5">
							<span class="lucide-circle-alert w-4 h-4" />
							<span>{{ __('Invites not sent') }}</span>
						</div>
						<Button
							size="sm"
							:loading="isRetrying(cls)"
							@click.stop="retryClassInvites(cls)"
						>
							{{ __('Retry') }}
						</Button>
					</div>
					<div
						v-if="canAccessClass(cls) && cls.join_url"
						class="flex items-center gap-x-2 text-ink-gray-9 mt-auto"
					>
						<a
							v-if="
								user.data?.is_moderator ||
								user.data?.is_evaluator ||
								batch.data?.can_manage
							"
							:href="safeUrl(cls.start_url || cls.join_url)"
							v-external
							class="cursor-pointer inline-flex items-center justify-center gap-2 transition-colors text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 h-7 text-base px-2 rounded-4"
							:class="cls.join_url ? 'w-full' : 'w-1/2'"
						>
							<span class="lucide-monitor h-4 w-4" />
							{{ __('Start') }}
						</a>
						<a
							:href="safeUrl(cls.join_url)"
							v-external
							class="w-full cursor-pointer inline-flex items-center justify-center gap-2 transition-colors text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 h-7 text-base px-2 rounded-4"
						>
							<span class="lucide-video h-4 w-4" />
							{{ __('Join') }}
						</a>
					</div>
					<Tooltip
						v-else-if="hasClassEnded(cls)"
						:text="__('This class has ended')"
						side="right"
					>
						<div class="flex items-center gap-x-2 text-ink-amber-5 w-fit">
							<span class="lucide-info w-4 h-4" />
							<span>
								{{ __('Ended') }}
							</span>
						</div>
					</Tooltip>
				</div>
			</div>
		</div>
		<div v-else class="text-ink-gray-7 mt-5">
			{{ __('No live classes scheduled') }}
		</div>
	</div>

	<LiveClassAttendance
		v-if="showAttendance"
		v-model="showAttendance"
		:live_class="attendanceFor"
	/>
</template>
<script setup>
// TODO(a11y): the class card is click-activated — it opens the attendance
// modal — but carries nested Start/Join anchors, so it cannot become a
// <button> without invalid nesting. Reaching it by keyboard needs a dedicated
// action control, which is a redesign rather than an attribute.
import {
	Alert,
	createListResource,
	createResource,
	Button,
	Tooltip,
	toast,
} from 'frappe-ui'
import { inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatTime } from '@/utils/'
import { openBatchForm } from '@/composables/useBatchForms'
import LiveClassAttendance from '@/components/Modals/LiveClassAttendance.vue'
import { safeUrl } from '@/utils/safeUrl'

const user = inject('$user')
const route = useRoute()
const router = useRouter()
const dayjs = inject('$dayjs')
const readOnlyMode = window.read_only_mode
const showAttendance = ref(false)
const attendanceFor = ref(null)

const props = defineProps({
	batch: {
		type: Object,
		required: true,
	},
})

// The `cache` key is what lets LiveClassForm refresh this list after a create
// without a prop or a defineModel between them: it looks the instance up by
// this exact key (getCachedListResource) rather than constructing one, so the
// options below stay authoritative. Keep the key in step with the form's.
const liveClasses = createListResource({
	doctype: 'LMS Live Class',
	cache: ['liveClasses', props.batch.data?.name],
	filters: {
		batch_name: props.batch.data?.name,
	},
	fields: [
		'name',
		'title',
		'description',
		'time',
		'date',
		'duration',
		'attendees',
		'start_url',
		'join_url',
		'owner',
		'conferencing_provider',
		'batch_name',
		'invite_status',
	],
	orderBy: 'date',
	auto: true,
})

// A class is Failed once Google Calendar has refused its learners' invites on
// every automatic retry; the hosts get a notification pointing here.
const retryInvites = createResource({
	url: 'lms.lms.doctype.lms_live_class.lms_live_class.retry_invites',
})

const isRetrying = (cls) =>
	retryInvites.loading && retryInvites.params?.live_class === cls.name

const retryClassInvites = (cls) => {
	retryInvites.submit(
		{ live_class: cls.name },
		{
			onSuccess(sent) {
				if (!sent) {
					toast.error(
						__(
							"Google Calendar still isn't responding. Try again in a few minutes."
						)
					)
					return
				}
				toast.success(__('Invites sent'))
				liveClasses.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const openLiveClassForm = () => {
	openBatchForm(router, 'NewLiveClass', props.batch.data?.name, route.hash)
}

const hasProviderAccount = () => {
	const data = props.batch.data
	if (data?.conferencing_provider === 'Zoom' && data?.zoom_account) return true
	if (
		data?.conferencing_provider === 'Google Meet' &&
		data?.google_meet_account
	)
		return true
	return false
}

// Moderators and the batch's instructors: the only users the server lets
// create a class or retry its invites. isAdmin also takes in every evaluator,
// who would only get a permission error.
const canManageClasses = () =>
	Boolean(user.data?.is_moderator || props.batch.data?.can_schedule_classes)

const canCreateClass = () => {
	if (readOnlyMode) return false
	if (!hasProviderAccount()) return false
	return canManageClasses()
}

const isAdmin = () => {
	return (
		user.data?.is_moderator ||
		user.data?.is_evaluator ||
		Boolean(props.batch.data?.can_manage)
	)
}

const canAccessClass = (cls) => {
	if (cls.date < dayjs().format('YYYY-MM-DD')) return false
	if (cls.date > dayjs().format('YYYY-MM-DD')) return false
	if (hasClassEnded(cls)) return false
	return true
}

const getClassStart = (cls) => {
	return new Date(`${cls.date}T${cls.time}`)
}

const getClassEnd = (cls) => {
	const classStart = getClassStart(cls)
	return new Date(classStart.getTime() + cls.duration * 60000)
}

const hasClassEnded = (cls) => {
	const classEnd = getClassEnd(cls)
	const now = new Date()
	return now > classEnd
}

const openAttendanceModal = (cls) => {
	if (!isAdmin()) return
	if (cls.attendees <= 0) return
	attendanceFor.value = cls
	showAttendance.value = true
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
