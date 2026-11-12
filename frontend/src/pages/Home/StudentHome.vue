<template>
	<LearnerWelcome v-if="learning.fetched && !items.length" />
	<div v-else class="mx-auto flex max-w-[1080px] flex-col gap-8">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl-semibold text-ink-gray-9">{{ greeting }}</h1>
				<p class="mt-1.5 text-base text-ink-gray-6">{{ streakLine }}</p>
			</div>
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-4 bg-surface-amber-2 px-2 py-1 text-base text-ink-gray-9"
				:aria-label="__('View learning streak: {0} days').format(streak)"
				@click="emit('streak')"
			>
				<span class="lucide-flame size-4 text-ink-amber-7" aria-hidden="true" />
				{{ streak }}
			</button>
		</header>

		<ResumeCard
			v-if="next"
			:title="next.title"
			:meta="next.meta"
			:progress="next.progress || 0"
			:action="__('Continue')"
			:route="next.route"
		/>

		<div class="flex flex-wrap items-start gap-8">
			<section
				aria-labelledby="your-learning"
				class="min-w-0 flex-[999_1_520px]"
			>
				<div class="mb-2 flex items-center justify-between gap-3">
					<h2 id="your-learning" class="text-lg-semibold text-ink-gray-9">
						{{ __('Your learning') }}
					</h2>
					<TabButtons v-model="tab" :options="tabs" />
				</div>
				<div
					v-if="shown.length"
					class="divide-y divide-outline-gray-2 border-t border-outline-gray-2"
				>
					<div v-for="item in shown" :key="item.type + item.title">
						<router-link
							:to="item.route"
							class="-mx-2.5 flex items-center gap-3.5 rounded-5 px-2.5 py-3.5 hover:bg-surface-gray-1"
						>
							<div class="min-w-0 flex-1">
								<div class="truncate text-base font-medium text-ink-gray-9">
									{{ item.title }}
								</div>
								<div class="mt-0.5 truncate text-p-sm text-ink-gray-6">
									{{ item.meta }}
								</div>
							</div>
							<Badge
								:label="kindLabel(item.type)"
								:theme="kindTheme(item.type)"
								size="md"
							/>
						</router-link>
					</div>
				</div>
				<p
					v-else-if="learning.fetched"
					class="border-t border-outline-gray-2 pt-4 text-p-base text-ink-gray-6"
				>
					{{
						tab === 'done'
							? __('Nothing finished yet. What you complete shows up here.')
							: __(
									'Nothing in progress. New skills and courses you join show up here.'
							  )
					}}
				</p>
			</section>

			<aside
				v-if="myLiveClasses.data?.length || evalCount"
				class="flex flex-[1_1_280px] flex-col gap-6"
			>
				<section
					v-if="myLiveClasses.data?.length"
					aria-labelledby="live-classes"
				>
					<h2 id="live-classes" class="mb-4 text-lg-semibold text-ink-gray-9">
						{{ __('Upcoming Live Classes') }}
					</h2>
					<div class="flex flex-col gap-4">
						<div
							v-for="cls in myLiveClasses.data"
							:key="cls.name"
							class="rounded-5 border p-3 hover:border-outline-gray-3"
						>
							<div class="mb-1 font-semibold leading-5 text-ink-gray-9">
								{{ cls.title }}
							</div>
							<div class="mb-4 leading-5 text-ink-gray-6">
								{{ cls.description }}
							</div>
							<LiveClassCard
								:cls="cls"
								class="space-y-4"
								ended-class="text-ink-amber-2"
							/>
						</div>
					</div>
				</section>
				<UpcomingEvaluations :forHome="true" stacked />
			</aside>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Badge, createResource, TabButtons } from 'frappe-ui'
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import LiveClassCard from '@/pages/Home/LiveClassCard.vue'
import LearnerWelcome from '@/pages/Home/LearnerWelcome.vue'
import ResumeCard from '@/pages/Home/ResumeCard.vue'
import { greeting as greet } from '@/pages/Home/greeting'

type HomeItem = {
	type: 'Skill' | 'Course' | 'Batch'
	title: string
	meta: string
	done: boolean
	progress?: number
	route: Record<string, unknown>
}

const props = defineProps<{
	myLiveClasses: any
	streakInfo: any
	evalCount: number
}>()

const emit = defineEmits<{ streak: [] }>()

const user = inject<any>('$user')
const tab = ref<'progress' | 'done'>('progress')
const tabs = [
	{ label: __('In progress'), value: 'progress' },
	{ label: __('Done'), value: 'done' },
]

const learning = createResource({
	url: 'lms.lms.home.my_learning_home',
	auto: true,
})

const items = computed<HomeItem[]>(() => learning.data || [])
const shown = computed(() =>
	items.value.filter((item) => item.done === (tab.value === 'done'))
)
// Batches have no progress of their own, so the card picks up a skill or course.
const next = computed(() =>
	items.value.find(
		(item) => !item.done && item.type !== 'Batch' && item.progress
	)
)

const streak = computed(() => props.streakInfo.data?.current_streak || 0)

const greeting = computed(() => greet(user.data?.full_name))

const streakLine = computed(() =>
	streak.value
		? __('Ten minutes today keeps your {0} day streak going.').format(
				streak.value
		  )
		: __('Ten minutes today starts a new streak.')
)

const kindTheme = (kind: HomeItem['type']) =>
	kind === 'Batch' ? 'amber' : kind === 'Skill' ? 'blue' : 'green'

const kindLabel = (kind: HomeItem['type']) =>
	kind === 'Batch' ? __('Batch') : kind === 'Skill' ? __('Skill') : __('Course')
</script>
