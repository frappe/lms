<template>
	<!-- <header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="[{ label: __('Home'), route: { name: 'Home' } }]" />
	</header> -->
	<div class="w-full px-5 pt-5 pb-10">
		<div class="flex items-center justify-between">
			<div class="space-y-2">
				<div class="text-xl font-bold">
					{{ __('Hey') }}, {{ user.data?.full_name }} 👋
				</div>
				<div class="text-lg text-ink-gray-6">
					{{ subtitle }}
				</div>
			</div>
			<div>
				<TabButtons v-if="isAdmin" v-model="currentTab" :buttons="tabs" />
				<div
					v-else
					@click="showStreakModal = true"
					class="bg-surface-amber-2 px-2 py-1 rounded-md cursor-pointer"
				>
					<span> 🔥 </span>
					<span>
						{{ streakInfo.data?.current_streak }}
					</span>
				</div>
			</div>
		</div>

		<AdminHome
			v-if="isAdmin && currentTab === 'instructor'"
			:liveClasses="adminLiveClasses"
			:evals="adminEvals"
		/>
		<StudentHome v-else :myLiveClasses="myLiveClasses" />
	</div>
	<Streak v-model="showStreakModal" :streakInfo="streakInfo" />
</template>
<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import {
	Breadcrumbs,
	call,
	createResource,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import StudentHome from '@/pages/Home/StudentHome.vue'
import AdminHome from '@/pages/Home/AdminHome.vue'
import Streak from '@/pages/Home/Streak.vue'

const user = inject<any>('$user')
const { brand } = sessionStore()
const evalCount = ref(0)
const currentTab = ref<'student' | 'instructor'>('instructor')
const showStreakModal = ref(false)

onMounted(() => {
	call('lms.lms.utils.get_upcoming_evals').then((data: any) => {
		evalCount.value = data.length
	})
})

const isAdmin = computed(() => {
	return (
		user.data?.is_moderator ||
		user.data?.is_instructor ||
		user.data?.is_evaluator
	)
})

const myLiveClasses = createResource({
	url: 'lms.lms.utils.get_my_live_classes',
	auto: !isAdmin.value ? true : false,
})

const adminLiveClasses = createResource({
	url: 'lms.lms.utils.get_admin_live_classes',
	auto: isAdmin.value ? true : false,
})

const adminEvals = createResource({
	url: 'lms.lms.utils.get_admin_evals',
	auto: isAdmin.value ? true : false,
})

const streakInfo = createResource({
	url: 'lms.lms.utils.get_streak_info',
	auto: true,
})

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
		let evalSuffix = evalCount.value > 1 ? __('evaluations') : __('evaluation')
		if (myLiveClasses.data?.length > 0 && evalCount.value > 0) {
			return __('You have {0} upcoming {1} and {2} {3} scheduled.').format(
				myLiveClasses.data.length,
				liveClassSuffix,
				evalCount.value,
				evalSuffix
			)
		} else if (myLiveClasses.data?.length > 0) {
			return __('You have {0} upcoming {1}.').format(
				myLiveClasses.data.length,
				liveClassSuffix
			)
		} else if (evalCount.value > 0) {
			return __('You have {0} {1} scheduled.').format(
				evalCount.value,
				evalSuffix
			)
		}
		return __('Resume where you left off')
	}
})

const tabs = [
	{ label: __('Student'), value: 'student' },
	{ label: __('Instructor'), value: 'instructor' },
]

usePageMeta(() => {
	return {
		title: __('Home'),
		icon: brand.favicon,
	}
})
</script>
