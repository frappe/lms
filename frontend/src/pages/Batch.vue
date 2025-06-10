<template>
	<div v-if="user.data?.is_moderator || isStudent" class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
			<div class="flex items-center space-x-2">
				<Button
					v-if="user.data?.is_moderator && batch.data?.certification"
					@click="openCertificateDialog = true"
				>
					{{ __('Generate Certificates') }}
				</Button>
				<Button v-if="canMakeAnnouncement()" @click="openAnnouncementModal()">
					<span>
						{{ __('Make an Announcement') }}
					</span>
					<template #suffix>
						<SendIcon class="h-4 stroke-1.5" />
					</template>
				</Button>
			</div>
		</header>
		<div
			v-if="batch.data"
			class="grid grid-cols-[75%,25%] h-[calc(100vh-3.2rem)]"
		>
			<div class="border-r">
				<Tabs
					v-model="tabIndex"
					as="div"
					:tabs="tabs"
					tablistClass="overflow-y-hidden bg-surface-white"
				>
					<template #tab="{ tab, selected }" class="overflow-x-hidden">
						<div>
							<button
								class="group -mb-px flex items-center gap-1 border-b border-transparent py-2.5 text-base text-ink-gray-5 duration-300 ease-in-out hover:border-outline-gray-3 hover:text-ink-gray-9"
								:class="{ 'text-ink-gray-9': selected }"
							>
								<component
									v-if="tab.icon"
									:is="tab.icon"
									class="h-4 stroke-1.5"
								/>
								{{ __(tab.label) }}
								<Badge
									v-if="tab.count"
									:class="{
										'text-ink-gray-9 border border-gray-900': selected,
									}"
									variant="subtle"
									theme="gray"
									size="sm"
								>
									{{ tab.count }}
								</Badge>
							</button>
						</div>
					</template>
					<template #tab-panel="{ tab }">
						<div class="pt-5 px-5 pb-10">
							<div v-if="tab.label == 'Courses'">
								<BatchCourses :batch="batch.data.name" />
							</div>
							<div v-else-if="tab.label == 'Dashboard' && isStudent">
								<BatchDashboard :batch="batch" :isStudent="isStudent" />
							</div>
							<div v-else-if="tab.label == 'Dashboard'">
								<BatchStudents :batch="batch" />
							</div>
							<div v-else-if="tab.label == 'Classes'">
								<LiveClass
									:batch="batch.data.name"
									:zoomAccount="batch.data.zoom_account"
								/>
							</div>
							<div v-else-if="tab.label == 'Assessments'">
								<Assessments :batch="batch.data.name" />
							</div>
							<div v-else-if="tab.label == 'Announcements'">
								<Announcements :batch="batch.data.name" />
							</div>
							<div v-else-if="tab.label == 'Discussions'">
								<Discussions
									doctype="LMS Batch"
									:docname="batch.data.name"
									:title="__('Discussions')"
									:key="batch.data.name"
									:singleThread="true"
									:scrollToBottom="false"
								/>
							</div>
						</div>
					</template>
				</Tabs>
			</div>
			<div class="p-5">
				<div class="mb-10">
					<div class="text-ink-gray-7 font-semibold mb-2">
						{{ __('About this batch') }}
					</div>
					<div
						v-html="batch.data.description"
						class="leading-5 mb-4 text-ink-gray-7"
					></div>

					<div class="flex items-center avatar-group overlap mb-5">
						<div
							class="h-6 mr-1"
							:class="{
								'avatar-group overlap': batch.data.instructors.length > 1,
							}"
						>
							<UserAvatar
								v-for="instructor in batch.data.instructors"
								:user="instructor"
							/>
						</div>
						<CourseInstructors :instructors="batch.data.instructors" />
					</div>
					<DateRange
						:startDate="batch.data.start_date"
						:endDate="batch.data.end_date"
						class="mb-3"
					/>
					<div class="flex items-center mb-3 text-ink-gray-7">
						<Clock class="h-4 w-4 stroke-1.5 mr-2" />
						<span>
							{{ formatTime(batch.data.start_time) }} -
							{{ formatTime(batch.data.end_time) }}
						</span>
					</div>
					<div
						v-if="batch.data.timezone"
						class="flex items-center mb-3 text-ink-gray-7"
					>
						<Globe class="h-4 w-4 stroke-1.5 mr-2" />
						<span>
							{{ batch.data.timezone }}
						</span>
					</div>
				</div>
				<div v-if="dayjs().isSameOrAfter(dayjs(batch.data.start_date))">
					<div class="text-ink-gray-7 font-semibold mb-2">
						{{ __('Feedback') }}
					</div>
					<BatchFeedback :batch="batch.data?.name" />
				</div>
			</div>
			<AnnouncementModal
				v-model="showAnnouncementModal"
				:batch="batch.data.name"
				:students="batch.data.students"
			/>
		</div>
	</div>
	<div v-else-if="!user.data?.name" class="">
		<div class="text-base border rounded-md w-1/3 mx-auto my-32">
			<div class="border-b px-5 py-3 font-medium">
				<span
					class="inline-flex items-center before:bg-surface-red-5 before:w-2 before:h-2 before:rounded-md before:mr-2"
				></span>
				{{ __('Not Permitted') }}
			</div>
			<div class="px-5 py-3">
				<div v-if="user.data" class="mb-4 leading-6">
					{{
						__(
							'You are not a member of this batch. Please checkout our upcoming batches.'
						)
					}}
				</div>
				<div v-else class="mb-4 leading-6">
					{{ __('Please login to access this page.') }}
				</div>
				<router-link
					v-if="user.data"
					:to="{
						name: 'Batches',
						params: {
							batchName: batch.data?.name,
						},
					}"
				>
					<Button variant="solid" class="w-full">
						{{ __('Upcoming Batches') }}
					</Button>
				</router-link>
				<Button
					v-else
					variant="solid"
					class="w-full"
					@click="redirectToLogin()"
				>
					{{ __('Login') }}
				</Button>
			</div>
		</div>
	</div>
	<BulkCertificates
		v-if="batch.data"
		v-model="openCertificateDialog"
		:batch="batch.data"
	/>
</template>
<script setup>
import { computed, inject, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
	Breadcrumbs,
	Button,
	createResource,
	Tabs,
	Badge,
	usePageMeta,
} from 'frappe-ui'
import {
	Clock,
	LayoutDashboard,
	BookOpen,
	Laptop,
	BookOpenCheck,
	Mail,
	SendIcon,
	MessageCircle,
	Globe,
	ClipboardPen,
} from 'lucide-vue-next'
import { formatTime } from '@/utils'
import { sessionStore } from '@/stores/session'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import BatchDashboard from '@/components/BatchDashboard.vue'
import BatchCourses from '@/components/BatchCourses.vue'
import LiveClass from '@/components/LiveClass.vue'
import BatchStudents from '@/components/BatchStudents.vue'
import Assessments from '@/components/Assessments.vue'
import Announcements from '@/components/Annoucements.vue'
import AnnouncementModal from '@/components/Modals/AnnouncementModal.vue'
import Discussions from '@/components/Discussions.vue'
import DateRange from '@/components/Common/DateRange.vue'
import BulkCertificates from '@/components/Modals/BulkCertificates.vue'
import BatchFeedback from '@/components/BatchFeedback.vue'
import dayjs from 'dayjs/esm'

const user = inject('$user')
const showAnnouncementModal = ref(false)
const openCertificateDialog = ref(false)
const route = useRoute()
const router = useRouter()
const { brand } = sessionStore()
const tabIndex = ref(0)
const readOnlyMode = window.read_only_mode

const tabs = computed(() => {
	let batchTabs = []
	batchTabs.push({
		label: 'Dashboard',
		icon: LayoutDashboard,
	})

	batchTabs.push({
		label: 'Courses',
		icon: BookOpen,
	})

	batchTabs.push({
		label: 'Classes',
		icon: Laptop,
	})

	if (user.data?.is_moderator) {
		batchTabs.push({
			label: 'Assessments',
			icon: BookOpenCheck,
		})
	}

	batchTabs.push({
		label: 'Announcements',
		icon: Mail,
	})

	batchTabs.push({
		label: 'Discussions',
		icon: MessageCircle,
	})
	return batchTabs
})

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	const hash = route.hash
	if (hash) {
		tabs.value.forEach((tab, index) => {
			if (tab.label?.toLowerCase() === hash.replace('#', '')) {
				tabIndex.value = index
			}
		})
	}
})

const batch = createResource({
	url: 'lms.lms.utils.get_batch_details',
	cache: ['batch', props.batchName],
	params: {
		batch: props.batchName,
	},
	auto: true,
})

const breadcrumbs = computed(() => {
	let crumbs = [{ label: 'Batches', route: { name: 'Batches' } }]
	if (!isStudent.value) {
		crumbs.push({
			label: 'Details',
			route: {
				name: 'BatchDetail',
				params: {
					batchName: batch.data?.name,
				},
			},
		})
	}
	crumbs.push({
		label: batch?.data?.title,
		route: { name: 'Batch', params: { batchName: props.batchName } },
	})
	return crumbs
})

const isStudent = computed(() => {
	return (
		user?.data &&
		batch.data?.students?.length &&
		batch.data?.students.includes(user.data.name)
	)
})

const redirectToLogin = () => {
	window.location.href = `/login?redirect-to=/lms/batches/${props.batchName}`
}

const openAnnouncementModal = () => {
	showAnnouncementModal.value = true
}

watch(tabIndex, () => {
	const tab = tabs.value[tabIndex.value]
	if (tab.label != route.hash.replace('#', '')) {
		router.push({ ...route, hash: `#${tab.label.toLowerCase()}` })
	}
})

const canMakeAnnouncement = () => {
	if (readOnlyMode) return false

	if (!batch.data?.students?.length) return false

	return user.data?.is_moderator || user.data?.is_evaluator
}

usePageMeta(() => {
	return {
		title: batch?.data?.title,
		icon: brand.favicon,
	}
})
</script>
