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

		<section
			aria-labelledby="teach"
			class="rounded-8 border border-outline-gray-2 bg-surface-base shadow-sm"
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
					class="flex flex-col gap-4 rounded-7 border border-outline-gray-2 p-5"
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
					<div
						class="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
						aria-hidden="true"
					>
						<div
							class="flex flex-col gap-1.5 rounded-5 bg-surface-gray-1 p-2.5"
						>
							<div class="flex items-start gap-1.5">
								<CharacterAvatar who="lumi" class="size-5 shrink-0" />
								<span
									class="rounded-4 bg-surface-base px-2 py-1 text-p-xs text-ink-gray-8"
								>
									{{ __('The alarm rings. What do you do first?') }}
								</span>
							</div>
							<span
								class="self-end rounded-4 bg-surface-gray-3 px-2 py-1 text-p-xs text-ink-gray-9"
							>
								{{ __('Grab my laptop?') }}
							</span>
							<span
								class="mt-auto flex items-center gap-1.5 text-p-xs text-ink-gray-6"
							>
								<span class="lucide-mic size-3" />
								{{ __('Then a role-play with a visitor') }}
							</span>
						</div>
						<div
							class="flex flex-col gap-1.5 rounded-5 bg-surface-gray-1 p-2.5"
						>
							<span class="text-p-xs text-ink-gray-6">{{
								__('Readiness')
							}}</span>
							<div class="flex h-12 items-end gap-1">
								<span
									v-for="(bar, index) in bars"
									:key="index"
									class="flex-1 rounded-2"
									:class="bar.tone"
									:style="{ height: bar.height }"
								/>
							</div>
							<span class="text-p-xs text-ink-gray-8">
								{{ __('34 of 40 ready') }}
							</span>
						</div>
					</div>
					<p class="mt-auto text-p-sm text-ink-gray-6">
						{{ __('Good for safety, compliance, customer calls, new tools.') }}
					</p>
					<Button
						class="self-start"
						variant="subtle"
						:label="__('Build a skill')"
						@click="pick('skill')"
					/>
				</article>

				<article
					class="flex flex-col gap-4 rounded-7 border border-outline-gray-2 p-5"
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
					<div
						class="flex flex-col gap-0.5 rounded-5 bg-surface-gray-1 px-3 py-2.5 text-p-sm text-ink-gray-8"
						:aria-hidden="example ? undefined : 'true'"
					>
						<span class="mb-1 text-p-xs text-ink-gray-6">
							{{ example?.title || __('Working with Frappe Books') }}
						</span>
						<span
							v-for="step in shownOutline"
							:key="step.label"
							class="flex items-center gap-2 py-1"
						>
							<span
								class="size-3.5 shrink-0"
								:class="step.icon"
								aria-hidden="true"
							/>
							{{ step.label }}
							<span v-if="step.meta" class="ms-auto text-p-xs text-ink-gray-6">
								{{ step.meta }}
							</span>
						</span>
					</div>
					<p class="mt-auto text-p-sm text-ink-gray-6">
						{{
							__(
								'Good for product training, onboarding programmes, courses you sell.'
							)
						}}
					</p>
					<div class="flex flex-wrap items-center gap-2">
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
import { computed, inject, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, call, TabButtons, Textarea, toast } from 'frappe-ui'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { greeting } from '@/pages/Home/greeting'

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

const pick = (value: 'skill' | 'course') => {
	if (value === 'course' && kind.value === 'course' && text.value.trim())
		return buildCourse()
	kind.value = value
	nextTick(() => field.value?.$el?.querySelector('textarea')?.focus())
}

const bars = [
	{ height: '30%', tone: 'bg-surface-gray-3' },
	{ height: '48%', tone: 'bg-surface-gray-3' },
	{ height: '62%', tone: 'bg-surface-gray-4' },
	{ height: '80%', tone: 'bg-surface-gray-6' },
	{ height: '100%', tone: 'bg-surface-green-6' },
]

const outline = [
	{
		label: __('1. Setting up your company'),
		icon: 'lucide-check text-ink-green-6',
	},
	{
		label: __('2. Your first invoice'),
		icon: 'lucide-play',
		meta: __('Video · 6 min'),
	},
	{
		label: __('3. Quiz: payments'),
		icon: 'lucide-circle-help',
		meta: __('8 questions'),
	},
	{ label: __('Certificate'), icon: 'lucide-award' },
]

const shownOutline = computed(() => {
	if (!props.example) return outline
	const lessons = props.example.lessons.map((title, index) => ({
		label: __('{0}. {1}').format(index + 1, title),
		icon: 'lucide-file-text',
		meta: '',
	}))
	return props.example.certificate
		? [...lessons, { label: __('Certificate'), icon: 'lucide-award', meta: '' }]
		: lessons
})

const steps = [
	__('Create a skill or course'),
	__('Invite your learners'),
	__('See how they are doing'),
]
</script>
