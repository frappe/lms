<template>
	<AdminWelcome
		v-if="home.fetched && !items.length"
		:example="home.data?.example"
	/>
	<div v-else class="mx-auto flex max-w-[1080px] flex-col gap-8">
		<AISetupNotice class="!mb-0" />
		<header>
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ greeting(user.data?.full_name) }}
			</h1>
			<p v-if="home.fetched" class="mt-1.5 text-base text-ink-gray-6">
				{{ subtitle }}
			</p>
		</header>

		<ResumeCard
			v-if="resume"
			:title="resume.title"
			:kind="resume.type"
			:meta="resume.meta"
			:action="__('Continue editing')"
			:route="resume.route"
			draft
		/>

		<div class="flex flex-wrap items-start gap-8">
			<section
				aria-labelledby="created-by-you"
				class="min-w-0 flex-[999_1_520px]"
			>
				<div class="mb-2 flex items-center justify-between gap-3">
					<h2 id="created-by-you" class="text-lg-semibold text-ink-gray-9">
						{{ __('Created by you') }}
					</h2>
					<TabButtons v-model="tab" :options="tabs" />
				</div>
				<div
					v-if="shown.length"
					class="divide-y divide-outline-gray-2 border-t border-outline-gray-2"
				>
					<div v-for="item in shown" :key="item.type + item.name">
						<router-link
							:to="item.route"
							class="-mx-2.5 flex items-center gap-3.5 rounded-5 px-2.5 py-3.5 hover:bg-surface-gray-1"
						>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="truncate text-base font-medium text-ink-gray-9">
									{{ item.title }}
								</div>
								<div class="truncate text-p-sm text-ink-gray-6">
									{{ item.meta }}
								</div>
							</div>
							<KindBadge class="shrink-0" :kind="item.type" size="sm" />
						</router-link>
					</div>
				</div>
				<p
					v-else-if="home.fetched"
					class="border-t border-outline-gray-2 pt-4 text-p-base text-ink-gray-6"
				>
					{{
						tab === 'drafts'
							? __('No drafts. Everything you made is published.')
							: __(
									'Nothing published yet. Publish a draft and it shows up here.'
							  )
					}}
				</p>
			</section>

			<aside
				v-if="liveClasses?.data?.length || evals?.data?.length"
				class="flex flex-[1_1_280px] flex-col gap-7"
			>
				<section v-if="liveClasses?.data?.length" aria-labelledby="admin-live">
					<h2
						id="admin-live"
						class="mb-2 flex h-7 items-center text-lg-semibold text-ink-gray-9"
					>
						{{ __('Upcoming Live Classes') }}
					</h2>
					<div class="flex flex-col gap-4">
						<div
							v-for="cls in liveClasses.data"
							:key="cls.name"
							class="rounded-5 border border-outline-gray-2 p-3 hover:border-outline-gray-3"
						>
							<div class="mb-1 font-semibold leading-5 text-ink-gray-9">
								{{ cls.title }}
							</div>
							<div
								v-if="cls.description"
								class="mb-4 leading-5 text-ink-gray-6"
							>
								{{ cls.description }}
							</div>
							<LiveClassCard
								:cls="cls"
								class="space-y-3"
								ended-class="text-ink-amber-7"
							/>
						</div>
					</div>
				</section>

				<section v-if="evals?.data?.length" aria-labelledby="admin-evals">
					<h2
						id="admin-evals"
						class="mb-2 flex h-7 items-center text-lg-semibold text-ink-gray-9"
					>
						{{ __('Upcoming Evaluations') }}
					</h2>
					<div class="flex flex-col gap-4">
						<component
							:is="user.data?.username ? 'router-link' : 'div'"
							v-for="evaluation in evals.data"
							:key="evaluation.name"
							:to="
								user.data?.username
									? profileRoute(
											user.data.username,
											'ProfileEvaluationSchedule'
									  )
									: undefined
							"
							class="rounded-5 border border-outline-gray-2 p-3 text-ink-gray-7 hover:border-outline-gray-3"
						>
							<div class="mb-3 font-semibold leading-5 text-ink-gray-9">
								{{ evaluation.course_title }}
							</div>
							<div class="flex flex-col gap-3">
								<div class="flex items-center gap-2">
									<span class="lucide-calendar size-4" aria-hidden="true" />
									{{ dayjs(evaluation.date).format('DD MMMM YYYY') }}
								</div>
								<div class="flex items-center gap-2">
									<span class="lucide-clock size-4" aria-hidden="true" />
									{{ formatTime(evaluation.start_time) }}
								</div>
								<div v-if="evaluation.timezone" class="flex items-center gap-2">
									<span class="lucide-globe size-4" aria-hidden="true" />
									{{ formatTimezone(evaluation.timezone, evaluation.date) }}
								</div>
								<div
									v-if="evaluation.member_name"
									class="flex items-center gap-2"
								>
									<span
										class="lucide-graduation-cap size-4"
										aria-hidden="true"
									/>
									{{ evaluation.member_name }}
								</div>
							</div>
						</component>
					</div>
				</section>
			</aside>
		</div>

		<AiConnect
			v-if="aiStatus.data && !aiStatus.data.ready"
			id="connect-ai"
			:embedding-only="aiStatus.data.embedding_needs_other_key"
			:chat-provider="aiStatus.data.chat_provider"
			@connected="aiStatus.reload()"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { createResource, TabButtons } from 'frappe-ui'
import KindBadge from '@/components/Home/KindBadge.vue'
import { formatTime } from '@/utils'
import { formatTimezone } from '@/utils/timezone'
import { profileRoute } from '@/utils/routes'
import AdminWelcome from '@/pages/Home/AdminWelcome.vue'
import AISetupNotice from '@/components/Goals/AISetupNotice.vue'
import AiConnect from '@/components/Goals/AiConnect.vue'
import LiveClassCard from '@/pages/Home/LiveClassCard.vue'
import ResumeCard from '@/pages/Home/ResumeCard.vue'
import { greeting } from '@/pages/Home/greeting'
import { useRoute } from 'vue-router'

type Kind = 'Skill' | 'Course' | 'Batch'
type MadeItem = {
	type: Kind
	name: string
	title: string
	meta: string
	published: boolean
	route: Record<string, unknown>
}

const props = defineProps<{
	liveClasses?: { data?: any[] }
	evals?: { data?: any[] }
}>()

const aiStatus = createResource({ url: 'lms.lms.ai.api.ai_status', auto: true })
// The notice's Connect button points at the card further down this same page.
const route = useRoute()
const scrollToConnect = () => {
	if (route.hash === '#connect-ai')
		setTimeout(
			() =>
				document
					.getElementById('connect-ai')
					?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
			300
		)
}
watch(() => route.hash, scrollToConnect)
onMounted(scrollToConnect)
const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')

const home = createResource({
	url: 'lms.lms.home.admin_home',
	auto: true,
})

const items = computed<MadeItem[]>(() => home.data?.items || [])
const resume = computed<MadeItem | null>(() => home.data?.resume || null)
const drafts = computed(() => items.value.filter((item) => !item.published))

const tab = ref<'published' | 'drafts'>('published')
const tabs = [
	{ label: __('Published'), value: 'published' },
	{ label: __('Drafts'), value: 'drafts' },
]
const shown = computed(() =>
	items.value.filter((item) => item.published === (tab.value === 'published'))
)

const withinWeek = (date: string) =>
	dayjs(date).diff(dayjs().startOf('day'), 'day') < 7

const when = (date: string) => {
	const days = dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day')
	if (days === 0) return __('today')
	if (days === 1) return __('tomorrow')
	return dayjs(date).format('dddd')
}

// Remind them of what is coming up this week; otherwise, what is waiting on them.
const subtitle = computed(() => {
	const cls = props.liveClasses?.data?.find((row) => withinWeek(row.date))
	const evaluation = props.evals?.data?.find((row) => withinWeek(row.date))
	const parts: string[] = []
	if (cls)
		parts.push(
			__('Live class {0} at {1}: {2}.').format(
				when(cls.date),
				formatTime(cls.time),
				cls.title
			)
		)
	if (evaluation)
		parts.push(
			__('Evaluation for {0} {1} at {2}.').format(
				evaluation.course_title,
				when(evaluation.date),
				formatTime(evaluation.start_time)
			)
		)
	if (parts.length) return parts.join(' ')

	if (drafts.value.length)
		parts.push(
			drafts.value.length === 1
				? __('One draft is waiting for you to publish.')
				: __('{0} drafts are waiting for you to publish.').format(
						drafts.value.length
				  )
		)
	return parts.length
		? parts.join(' ')
		: __('Everything you made is published. Share it and watch people learn.')
})
</script>
