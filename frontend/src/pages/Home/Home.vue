<template>
	<div class="flex w-full flex-1 flex-col p-5">
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h1 class="text-2xl-bold text-ink-gray-9">
					{{ __('Hey, {0}').format(user.data?.full_name ?? '') }} 👋
				</h1>
				<div>
					<button
						v-if="!isAdmin"
						type="button"
						@click="showStreakModal = true"
						:aria-label="
							__('View learning streak: {0} days').format(
								streakInfo.data?.current_streak || 0
							)
						"
						class="bg-surface-amber-2 px-2 py-1 rounded-5 cursor-pointer"
					>
						<span> 🔥 </span>
						<span class="text-ink-gray-9">
							{{ streakInfo.data?.current_streak }}
						</span>
					</button>
				</div>
			</div>

			<SkeletonText
				v-if="isSubtitlePending"
				text="text-lg leading-6"
				width="w-80"
				class="max-w-full motion-safe:animate-pulse"
				aria-hidden="true"
				data-testid="subtitle-skeleton"
			/>
			<div v-else class="text-lg text-ink-gray-6 leading-6">
				{{ subtitle }}
			</div>
		</div>

		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>

		<AdminHome
			v-if="isAdmin && currentTab === 'instructor'"
			:liveClasses="adminLiveClasses"
			:evals="adminEvals"
			@pending="sectionsPending = $event"
		/>
		<StudentHome
			v-else-if="currentTab === 'student'"
			:myLiveClasses="myLiveClasses"
			@pending="sectionsPending = $event"
		/>
	</div>
	<Streak v-model="showStreakModal" :streakInfo="streakInfo" />
</template>
<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { call, createResource, usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import StudentHome from '@/pages/Home/StudentHome.vue'
import AdminHome from '@/pages/Home/AdminHome.vue'
import Streak from '@/pages/Home/Streak.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'
import { isPending } from '@/pages/Home/pending'
import { useLoadingAnnouncement } from '@/utils/a11y'

const user = inject<any>('$user')
const { brand } = sessionStore()
const evalCount = ref<number | null>(null)
const currentTab = ref<'student' | 'instructor'>('student')
const showStreakModal = ref(false)

const fetchEvalCount = () => {
	call('frappe.client.get_count', {
		doctype: 'LMS Certificate Request',
		filters: {
			member: user?.data?.name,
			status: 'Upcoming',
			date: ['>=', inject<any>('$dayjs')().format('YYYY-MM-DD')],
		},
	})
		.then((data: any) => {
			evalCount.value = data
		})
		.catch(() => {
			evalCount.value = 0
		})
}

const isAdmin = computed(() => {
	return (
		user.data?.is_moderator ||
		user.data?.is_instructor ||
		user.data?.is_evaluator
	)
})

// The subtitle counts these, so it waits for them rather than changing words.
const isSubtitlePending = computed(() => {
	if (isAdmin.value) {
		return isPending(adminLiveClasses) || isPending(adminEvals)
	}
	return isPending(myLiveClasses) || evalCount.value === null
})

onMounted(() => {
	if (isAdmin.value) {
		currentTab.value = 'instructor'
	} else {
		currentTab.value = 'student'
		fetchEvalCount()
	}
})

const myLiveClasses = createResource({
	url: 'lms.lms.api.get_my_live_classes',
	auto: !isAdmin.value ? true : false,
})

const adminLiveClasses = createResource({
	url: 'lms.lms.api.get_admin_live_classes',
	auto: isAdmin.value ? true : false,
})

const adminEvals = createResource({
	url: 'lms.lms.api.get_admin_evals',
	auto: isAdmin.value ? true : false,
})

const streakInfo = createResource({
	url: 'lms.lms.api.get_streak_info',
	auto: true,
})

const sectionsPending = ref(true)

const loadingAnnouncement = useLoadingAnnouncement(
	() => isSubtitlePending.value || sectionsPending.value,
	() => __('Home loaded')
)

const subtitle = computed(() => {
	if (isAdmin.value) {
		let liveClassSuffix =
			adminLiveClasses.data?.length > 1 ? __('live classes') : __('live class')
		let evalSuffix =
			adminEvals.data?.length > 1 ? __('evaluations') : __('evaluation')
		if (adminLiveClasses.data?.length > 0 && adminEvals.data?.length > 0) {
			return __('You have {0} upcoming {1} and {2} {3} scheduled.').format(
				adminLiveClasses.data.length,
				liveClassSuffix,
				adminEvals.data.length,
				evalSuffix
			)
		} else if (adminLiveClasses.data?.length > 0) {
			return __('You have {0} upcoming {1}.').format(
				adminLiveClasses.data.length,
				liveClassSuffix
			)
		} else if (adminEvals.data?.length > 0) {
			return __('You have {0} {1} scheduled.').format(
				adminEvals.data.length,
				evalSuffix
			)
		}
		return __('Manage your courses and batches at a glance')
	} else {
		let liveClassSuffix =
			myLiveClasses.data?.length > 1 ? __('live classes') : __('live class')
		const evaluationCount = evalCount.value ?? 0
		let evalSuffix = evaluationCount > 1 ? __('evaluations') : __('evaluation')
		if (myLiveClasses.data?.length > 0 && evaluationCount > 0) {
			return __('You have {0} upcoming {1} and {2} {3} scheduled.').format(
				myLiveClasses.data.length,
				liveClassSuffix,
				evaluationCount,
				evalSuffix
			)
		} else if (myLiveClasses.data?.length > 0) {
			return __('You have {0} upcoming {1}.').format(
				myLiveClasses.data.length,
				liveClassSuffix
			)
		} else if (evaluationCount > 0) {
			return __('You have {0} {1} scheduled.').format(
				evaluationCount,
				evalSuffix
			)
		}
		return __('Resume where you left off')
	}
})

usePageMeta(() => {
	return {
		title: __('Home'),
		icon: brand.favicon,
	}
})
</script>
