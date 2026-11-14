<template>
	<div class="mx-auto flex max-w-[1080px] flex-col gap-8">
		<header>
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ greeting(user.data?.full_name) }}
			</h1>
			<p class="mt-1.5 text-base text-ink-gray-6">
				{{
					__(
						'Say what people should learn, and the first version is drafted for you. You shape it from there.'
					)
				}}
			</p>
		</header>

		<!-- Nothing here works without a model. The composer waits until one is connected; the
		     card that connects it sits at the bottom, so the page first shows what Learning is. -->
		<section
			v-if="aiStatus.data?.ready"
			ref="composer"
			aria-labelledby="teach"
			class="rounded-8 border border-outline-gray-2 bg-surface-base shadow-sm transition-shadow"
			:class="flash ? 'ring-2 ring-outline-gray-3' : ''"
		>
			<div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
				<h2 id="teach" class="text-lg-semibold text-ink-gray-9">
					{{ __('What do you want to teach?') }}
				</h2>
				<TabButtons v-model="kind" :options="kinds" />
			</div>
			<div class="px-2 pt-2" @focusin="focused = true">
				<Textarea
					ref="field"
					v-model="text"
					variant="ghost"
					class="[&_textarea]:resize-none resize-none"
					size="lg"
					:rows="2"
					:aria-label="__('What do you want to teach?')"
					:placeholder="
						kind === 'skill'
							? __(
									'Stay calm and get everyone out safely when the fire alarm rings'
							  )
							: __('Working with Frappe Books')
					"
				/>
			</div>
			<div class="flex flex-wrap items-center gap-2 px-5 pb-4 pt-2">
				<Button
					v-if="kind === 'skill'"
					:label="__('Add a PDF, slides or documentation')"
					@click="openBuilder"
				>
					<template #prefix>
						<span class="lucide-paperclip size-4" aria-hidden="true" />
					</template>
				</Button>
				<span class="text-p-sm text-ink-gray-6">
					{{
						kind === 'skill'
							? __('Lumi sticks to your material when you add it.')
							: __('Add chapters, videos and quizzes next.')
					}}
				</span>
				<Button
					v-if="kind === 'skill'"
					class="w-full sm:ms-auto sm:w-auto"
					variant="solid"
					:label="__('Build it with Lumi')"
					:loading="busy === 'build'"
					:disabled="!text.trim()"
					@click="buildSkill"
				>
					<template #prefix>
						<span class="lucide-sparkles size-4" aria-hidden="true" />
					</template>
				</Button>
				<Button
					v-else
					class="w-full sm:ms-auto sm:w-auto"
					variant="solid"
					:label="__('Create course')"
					@click="buildCourse"
				/>
			</div>
			<!-- Ideas wait until the person is in the box, so the page opens quiet. -->
			<div
				v-if="focused"
				class="flex flex-wrap gap-2 border-t border-outline-gray-1 px-5 py-3"
			>
				<Button
					v-for="idea in ideas"
					:key="idea"
					variant="outline"
					size="sm"
					class="!rounded-full"
					:label="idea"
					@click="text = idea"
				/>
			</div>
		</section>

		<section aria-labelledby="two-ways" class="flex flex-col gap-4">
			<h2 id="two-ways" class="text-lg-semibold text-ink-gray-9">
				{{ __('Two ways to teach') }}
			</h2>
			<div
				class="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4"
			>
				<article
					class="flex flex-col gap-3 rounded-7 border border-outline-gray-2 p-5"
				>
					<KindBadge class="self-start" kind="skill" />
					<div>
						<h3 class="text-lg-semibold text-ink-gray-9">
							{{ __('One thing people must be able to do') }}
						</h3>
						<p class="mt-1 text-p-base text-ink-gray-6">
							{{ __('Ten minutes with Lumi: a lesson, a practice, a check.') }}
						</p>
					</div>
					<Button
						class="mt-auto self-start"
						variant="subtle"
						:label="__('Build a skill')"
						@click="pick('skill')"
					/>
				</article>

				<article
					class="flex flex-col gap-3 rounded-7 border border-outline-gray-2 p-5"
				>
					<KindBadge class="self-start" kind="course" />
					<div>
						<h3 class="text-lg-semibold text-ink-gray-9">
							{{ __('A topic that needs depth') }}
						</h3>
						<p class="mt-1 text-p-base text-ink-gray-6">
							{{
								__('Chapters, quizzes and a certificate, at their own pace.')
							}}
						</p>
					</div>
					<div class="mt-auto flex flex-wrap items-center gap-2">
						<Button
							variant="subtle"
							:label="__('Build a course')"
							@click="pick('course')"
						/>
						<Button
							v-if="example"
							variant="subtle"
							:label="__('See an example course')"
							:route="example.route"
						/>
					</div>
				</article>
			</div>
		</section>

		<!-- What happens after building: three short steps, in the same voice as the cards. -->
		<section aria-labelledby="next-steps">
			<h2 id="next-steps" class="sr-only">{{ __('Then') }}</h2>
			<ol
				class="grid grid-cols-1 gap-4 rounded-7 bg-surface-gray-1 p-5 sm:grid-cols-3 sm:gap-8"
			>
				<li v-for="(step, index) in steps" :key="step.title" class="flex gap-3">
					<span
						class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-base text-p-xs font-semibold text-ink-gray-8"
					>
						{{ index + 1 }}
					</span>
					<div>
						<div class="text-base font-medium text-ink-gray-9">
							{{ step.title }}
						</div>
						<p class="mt-0.5 text-p-sm text-ink-gray-6">{{ step.text }}</p>
					</div>
				</li>
			</ol>
		</section>

		<AiConnect
			v-if="aiStatus.data && !aiStatus.data.ready"
			id="connect-ai"
			ref="setupCard"
			:embedding-only="aiStatus.data.embedding_needs_other_key"
			:chat-provider="aiStatus.data.chat_provider"
			:flash="flash && !aiStatus.data.ready"
			@connected="aiStatus.reload()"
		/>
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	inject,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
} from 'vue'
import { useRouter } from 'vue-router'
import {
	Badge,
	Button,
	call,
	createResource,
	TabButtons,
	Textarea,
	toast,
} from 'frappe-ui'
import { greeting } from '@/pages/Home/greeting'
import { NEW } from '@/utils/goals'
import AiConnect from '@/components/Goals/AiConnect.vue'
import KindBadge from '@/components/Home/KindBadge.vue'

type Example = {
	name: string
	title: string
	lessons: string[]
	certificate: boolean
	route: Record<string, unknown>
}

// The site's demo course, when it has one: a real course to look at instead of
// a made-up outline.
const props = defineProps<{ example?: Example | null }>()

const user = inject<any>('$user')
const router = useRouter()

const kind = ref<'skill' | 'course'>('skill')
const kinds = [
	{ label: __('A skill'), value: 'skill' },
	{ label: __('A course'), value: 'course' },
]
const text = ref('')
const focused = ref(false)
const busy = ref<'' | 'build'>('')
const field = ref<any>(null)

const ideas = computed(() =>
	kind.value === 'skill'
		? [
				__('Calm an angry customer on a call'),
				__('Spot and report harassment at work'),
				__('Run a safety check before using a forklift'),
				__('Explain our product in two minutes'),
		  ]
		: [
				__('Product training for new joiners'),
				__('Excel basics'),
				__('Sales basics for new reps'),
		  ]
)

// Build is the one action here that makes a skill: it needs an outcome to draft from.
const buildSkill = async () => {
	const outcome = text.value.trim()
	if (!outcome || busy.value) return
	busy.value = 'build'
	try {
		const goal = await call('lms.lms.ai.api.create_goal', { outcome })
		await call('lms.lms.ai.api.draft_plan', { goal })
		await router.push({ name: 'GoalBuilder', params: { goal } })
	} catch (error: any) {
		toast.error(
			error?.messages?.[0] || __('Could not start the skill. Try again.')
		)
	} finally {
		busy.value = ''
	}
}

// Material is added in the builder; the skill is created there on the first thing done.
const openBuilder = () => {
	const outcome = text.value.trim()
	router.push({
		name: 'GoalBuilder',
		params: { goal: NEW },
		query: outcome ? { outcome } : {},
	})
}

const buildCourse = () => {
	const title = text.value.trim()
	router.push({ name: 'NewCourse', query: title ? { title } : {} })
}

const composer = ref<HTMLElement | null>(null)
const setupCard = ref<{ $el: HTMLElement } | null>(null)
const flash = ref(false)

// The cards' buttons set the composer up; when it already is, the only honest answer is to
// take the person to it: scroll there, light it up for a moment, put the cursor in the box.
// Without a model yet, they lead to the card that connects one instead.
const pick = (value: 'skill' | 'course') => {
	if (value === 'course' && kind.value === 'course' && text.value.trim())
		return buildCourse()
	kind.value = value
	const target = aiStatus.data?.ready ? composer.value : setupCard.value?.$el
	target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	flash.value = true
	setTimeout(() => (flash.value = false), 1200)
	if (aiStatus.data?.ready)
		nextTick(() =>
			composer.value?.querySelector('textarea')?.focus({ preventScroll: true })
		)
}

// Whether the site has a chat model and an embedding model. Checked again whenever this tab
// comes back into focus, since the settings open in another tab.
const aiStatus = createResource({ url: 'lms.lms.ai.api.ai_status', auto: true })
const recheck = () => {
	if (aiStatus.data && !aiStatus.data.ready) aiStatus.reload()
}
onMounted(() => {
	window.addEventListener('focus', recheck)
	if (window.location.hash === '#connect-ai')
		setTimeout(
			() => setupCard.value?.$el?.scrollIntoView({ block: 'center' }),
			300
		)
})
onBeforeUnmount(() => window.removeEventListener('focus', recheck))

const steps = [
	{
		title: __('Build it'),
		text: __('A skill in minutes, or a course with chapters.'),
	},
	{
		title: __('Share it'),
		text: __('Add people and a due date. They get reminded.'),
	},
	{
		title: __('See who is ready'),
		text: __('And who is stuck, before it matters.'),
	},
]
</script>
