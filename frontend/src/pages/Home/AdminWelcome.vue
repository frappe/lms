<template>
	<div class="mx-auto flex max-w-[1080px] flex-col gap-8">
		<header>
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ greeting(user.data?.full_name) }}
			</h1>
			<p class="mt-1.5 text-base text-ink-gray-6">
				{{
					__(
						'Teach anything in minutes. Tell Lumi what people should learn and it drafts the first version for you.'
					)
				}}
			</p>
		</header>

		<!-- Nothing here works without a model, so connecting one is the first step and takes
		     the composer's place until both settings are in. -->
		<section
			v-if="aiStatus.data && !aiStatus.data.ready"
			aria-labelledby="connect-ai"
			class="rounded-8 border border-outline-gray-2 bg-surface-base p-5 shadow-sm"
		>
			<h2 id="connect-ai" class="text-lg-semibold text-ink-gray-9">
				{{ __('First, connect an AI model') }}
			</h2>
			<p class="mt-1 text-p-base text-ink-gray-6">
				{{
					__(
						'Lumi drafts your plans, tutors your learners and reviews their role-plays with it. Two settings, about five minutes.'
					)
				}}
			</p>
			<ol class="mt-4 divide-y divide-outline-gray-1">
				<li
					v-for="(step, index) in setupSteps"
					:key="step.key"
					class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
				>
					<span
						class="flex size-6 shrink-0 items-center justify-center rounded-full text-p-xs font-medium"
						:class="
							step.done
								? 'bg-surface-green-2 text-ink-green-6'
								: 'bg-surface-gray-2 text-ink-gray-7'
						"
					>
						<span v-if="step.done" class="lucide-check size-3.5" />
						<template v-else>{{ index + 1 }}</template>
					</span>
					<div class="min-w-0 flex-1">
						<div class="text-base font-medium text-ink-gray-9">
							{{ step.title }}
						</div>
						<div class="text-p-sm text-ink-gray-6">{{ step.hint }}</div>
					</div>
					<span v-if="step.done" class="text-p-sm text-ink-gray-6">
						{{ __('Done') }}
					</span>
					<Button
						v-else
						:variant="step.key === firstPending ? 'solid' : 'subtle'"
						:href="safeUrl(step.href)"
						:label="step.action"
					/>
				</li>
			</ol>
			<p class="mt-3 text-p-sm text-ink-gray-6">
				{{
					__(
						'Come back to this tab when both are set. It checks again on its own.'
					)
				}}
			</p>
		</section>

		<section
			v-else-if="aiStatus.data"
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
			<div class="px-2 pt-2">
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
					:label="__('Add a policy, slides or notes')"
					:loading="busy === 'material'"
					@click="buildSkill(false)"
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
					@click="buildSkill(true)"
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
			<div
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
					<div class="flex items-center justify-between gap-2">
						<Badge :label="__('Skill')" theme="blue" size="md" />
						<span class="text-p-sm text-ink-gray-6">
							{{ __('About 10 minutes each') }}
						</span>
					</div>
					<div>
						<h3 class="text-lg-semibold text-ink-gray-9">
							{{ __('One thing people must be able to do') }}
						</h3>
						<p class="mt-1.5 text-p-base text-ink-gray-6">
							{{
								__(
									'A lesson that adapts to each person, a practice conversation, and a check that proves they are ready.'
								)
							}}
						</p>
					</div>
					<p class="text-p-sm text-ink-gray-6">
						{{ __('Good for safety, compliance, customer calls, new tools.') }}
					</p>
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
					<div class="flex items-center justify-between gap-2">
						<Badge :label="__('Course')" theme="green" size="md" />
						<span class="text-p-sm text-ink-gray-6">
							{{ __('Hours, at their own pace') }}
						</span>
					</div>
					<div>
						<h3 class="text-lg-semibold text-ink-gray-9">
							{{ __('A topic that needs depth') }}
						</h3>
						<p class="mt-1.5 text-p-base text-ink-gray-6">
							{{
								__(
									'Chapters of video and reading, quizzes and assignments along the way, and a certificate at the end.'
								)
							}}
						</p>
					</div>
					<p class="text-p-sm text-ink-gray-6">
						{{
							__(
								'Good for product training, onboarding programmes, courses you sell.'
							)
						}}
					</p>
					<div class="mt-auto flex flex-wrap items-center gap-2">
						<Button
							variant="subtle"
							:label="__('Build a course')"
							@click="pick('course')"
						/>
						<Button
							v-if="example"
							variant="ghost"
							:label="__('See an example course')"
							:route="example.route"
						/>
					</div>
				</article>
			</div>
		</section>

		<section
			:aria-label="__('Then share it with your learners')"
			class="flex flex-wrap items-center gap-6 rounded-7 bg-surface-gray-1 px-6 py-5"
		>
			<div class="min-w-0 flex-[1_1_260px]">
				<div class="text-base font-semibold text-ink-gray-9">
					{{ __('Then share it with your learners') }}
				</div>
				<p class="mt-1 text-p-base text-ink-gray-6">
					{{
						__(
							'Add people and set a due date, and Learning reminds them for you. Teaching live? Put a course in a batch with classes and evaluations.'
						)
					}}
				</p>
			</div>
			<ol class="flex flex-wrap gap-5 text-p-sm text-ink-gray-8">
				<li
					v-for="(step, index) in steps"
					:key="step"
					class="flex items-center gap-2"
				>
					<span
						class="inline-flex size-5 items-center justify-center rounded-full border border-outline-gray-3 bg-surface-base text-p-xs font-semibold"
					>
						{{ index + 1 }}
					</span>
					{{ step }}
				</li>
			</ol>
		</section>
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
import { safeUrl } from '@/utils/safeUrl'

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
const busy = ref<'' | 'build' | 'material'>('')
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

// A skill starts as what people should be able to do. With "Build it with
// Lumi" the plan starts drafting straight away; otherwise the editor opens for
// material first.
const buildSkill = async (draft: boolean) => {
	busy.value = draft ? 'build' : 'material'
	try {
		const outcome = text.value.trim()
		const goal = await call('lms.lms.ai.api.create_goal', {
			outcome: outcome || undefined,
		})
		if (draft && outcome) await call('lms.lms.ai.api.draft_plan', { goal })
		router.push({ name: 'GoalBuilder', params: { goal } })
	} catch (error: any) {
		toast.error(
			error?.messages?.[0] || __('Could not start the skill. Try again.')
		)
	} finally {
		busy.value = ''
	}
}

const buildCourse = () => {
	const title = text.value.trim()
	router.push({ name: 'NewCourse', query: title ? { title } : {} })
}

const composer = ref<HTMLElement | null>(null)
const flash = ref(false)

// The cards' buttons set the composer up; when it already is, the only honest answer is to
// take the person to it: scroll there, light it up for a moment, put the cursor in the box.
const pick = (value: 'skill' | 'course') => {
	if (value === 'course' && kind.value === 'course' && text.value.trim())
		return buildCourse()
	kind.value = value
	composer.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	flash.value = true
	setTimeout(() => (flash.value = false), 1200)
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
onMounted(() => window.addEventListener('focus', recheck))
onBeforeUnmount(() => window.removeEventListener('focus', recheck))

const setupSteps = computed(() => [
	{
		key: 'chat',
		title: __('A chat model'),
		hint: __('Any provider works: Gemini, OpenAI, OpenRouter and more.'),
		done: Boolean(aiStatus.data?.chat_model),
		href: '/app/flow-model/new',
		action: __('Add a model'),
	},
	{
		key: 'embedding',
		title: __('An embedding model'),
		hint: __('Lets Lumi search the material you add.'),
		done: Boolean(aiStatus.data?.embedding_model),
		href: '/app/flow-knowledge-settings',
		action: __('Choose a model'),
	},
])
const firstPending = computed(
	() => setupSteps.value.find((step) => !step.done)?.key
)

const steps = [
	__('Create a skill or course'),
	__('Invite your learners'),
	__('See how they are doing'),
]
</script>
