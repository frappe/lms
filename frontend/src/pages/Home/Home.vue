<template>
	<!-- <header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="[{ label: __('Home'), route: { name: 'Home' } }]" />
	</header> -->
	<div class="w-full px-5 pt-10 pb-10">
		<div class="flex items-center justify-between">
			<div class="space-y-2">
				<div class="text-xl font-bold">
					{{ __('Hey') }}, {{ user.data?.full_name }} 👋
				</div>
				<div class="text-lg text-ink-gray-6">
					<span v-if="isAdmin">
						{{ __('Manage your courses and batches at a glance') }}
					</span>
					<span v-else-if="myLiveClasses.data?.length > 0 || evalCount > 0">
						<span v-if="myLiveClasses.data?.length > 0">
							{{
								__('You have {0} upcoming live classes').format(
									myLiveClasses.data.length
								)
							}}
						</span>
						<span v-if="evalCount > 0">
							{{ __(' and {0} evaluation').format(evalCount) }}
						</span>
						<span>
							{{ __(' scheduled.') }}
						</span>
					</span>
					<span v-else-if="myLiveClasses.data?.length > 0">
						{{
							__('You have {0} upcoming live classes.').format(
								myLiveClasses.data.length
							)
						}}
					</span>
					<span v-else-if="evalCount > 0">
						{{ __('You have {0} evaluations scheduled.').format(evalCount) }}
					</span>
					<span v-else>
						{{ __('Resume where you left off') }}
					</span>
				</div>
			</div>
			<div>
				<TabButtons v-if="isAdmin" v-model="currentTab" :buttons="tabs" />
			</div>
		</div>

		<AdminHome v-if="isAdmin && currentTab === 'instructor'" />
		<StudentHome v-else :myLiveClasses="myLiveClasses" />
	</div>
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

const user = inject<any>('$user')
const { brand } = sessionStore()
const evalCount = ref(0)
const currentTab = ref<'student' | 'instructor'>('instructor')

onMounted(() => {
	call('lms.lms.utils.get_upcoming_evals').then((data: any) => {
		evalCount.value = data.length
	})
})

const myLiveClasses = createResource({
	url: 'lms.lms.utils.get_my_live_classes',
	auto: true,
})

const tabs = [
	{ label: __('Student'), value: 'student' },
	{ label: __('Instructor'), value: 'instructor' },
]

const isAdmin = computed(() => {
	return (
		user.data?.is_moderator ||
		user.data?.is_instructor ||
		user.data?.is_evaluator
	)
})

usePageMeta(() => {
	return {
		title: __('Home'),
		icon: brand.favicon,
	}
})
</script>
