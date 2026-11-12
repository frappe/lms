<template>
	<article
		class="group relative flex gap-3.5 border-b border-outline-gray-2 py-4 last:border-b-0"
	>
		<button
			type="button"
			class="activity-handle mt-0.5 shrink-0 self-start cursor-grab rounded-full active:cursor-grabbing"
			:aria-label="__('Drag to reorder, or press the up and down arrow keys')"
			@keydown.up.prevent="!first && emit('move', -1)"
			@keydown.down.prevent="!last && emit('move', 1)"
		>
			<CharacterAvatar
				v-if="avatar"
				:who="avatar"
				:label="avatarLabel"
				class="size-8"
			/>
			<span
				v-else
				class="flex size-8 items-center justify-center rounded-full bg-surface-gray-2"
			>
				<span
					class="size-4 text-ink-gray-7"
					:class="activityIcon[activity.activity_type]"
				/>
			</span>
		</button>

		<div class="min-w-0 flex-1">
			<div class="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
				<div class="w-full min-w-0 flex-1">
					<input
						v-model="activity.title"
						class="-mx-1.5 w-[calc(100%+0.75rem)] rounded-4 border-0 bg-transparent px-1.5 py-0 text-base font-semibold text-ink-gray-9 hover:bg-surface-gray-2 focus:bg-surface-gray-2 focus:outline-none focus:ring-0"
						:aria-label="__('Activity title')"
						@change="emit('change')"
					/>
					<div
						v-if="activity.activity_type === 'Check'"
						class="mt-1.5 flex flex-wrap items-center gap-2 text-p-base text-ink-gray-6"
					>
						<div class="w-36 shrink-0">
							<FormControl
								type="select"
								size="sm"
								:aria-label="__('Number of questions')"
								:options="questionOptions"
								:model-value="String(checkQuestions || 5)"
								@update:model-value="
									(value) => emit('checkQuestions', Number(value))
								"
							/>
						</div>
						<span>{{
							__('one per key idea, plus what each learner found hardest')
						}}</span>
						<button
							type="button"
							class="inline-flex items-center gap-1 rounded-4 text-p-sm text-ink-gray-6 hover:text-ink-gray-8"
							:aria-expanded="open"
							@click="open = !open"
						>
							{{ open ? __('Hide questions') : __('See questions') }}
							<span
								class="size-3.5"
								:class="open ? 'lucide-chevron-up' : 'lucide-chevron-down'"
								aria-hidden="true"
							/>
						</button>
					</div>
					<button
						v-else
						type="button"
						class="mt-0.5 inline-flex items-center gap-1 rounded-4 text-start text-p-base text-ink-gray-6 hover:text-ink-gray-8"
						:aria-expanded="open"
						@click="open = !open"
					>
						{{ meta }}
						<span
							class="size-3.5 shrink-0"
							:class="open ? 'lucide-chevron-up' : 'lucide-chevron-down'"
							aria-hidden="true"
						/>
					</button>
				</div>
				<div
					role="toolbar"
					:aria-label="__('Activity actions')"
					class="flex shrink-0 gap-0.5 rounded-6 border border-outline-gray-2 bg-surface-base p-0.5 shadow-sm transition-opacity sm:absolute sm:end-0 sm:top-3 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
				>
					<Button
						variant="ghost"
						size="sm"
						:aria-expanded="asking"
						:disabled="revising"
						@click="asking = !asking"
					>
						{{ __('Change with AI') }}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="text-ink-red-6"
						@click="emit('remove')"
					>
						{{ __('Remove') }}
					</Button>
				</div>
			</div>

			<div
				v-if="revising"
				class="mt-3 flex items-center gap-2 text-p-sm text-ink-gray-7"
			>
				<LoadingIndicator class="size-4" />
				{{
					__('Reworking this activity. The rest of the plan stays as it is.')
				}}
			</div>
			<form
				v-else-if="asking"
				class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
				@submit.prevent="submitChange"
			>
				<FormControl
					v-model="request"
					variant="outline"
					class="flex-1"
					:label="__('What should change?')"
					:placeholder="
						__(
							'For example: make it harder, set it in our Pune office, or add a question on deadlines'
						)
					"
				/>
				<div class="flex gap-2">
					<Button type="button" @click="asking = false">{{
						__('Cancel')
					}}</Button>
					<Button type="submit" variant="solid" :disabled="!request.trim()">{{
						__('Change it')
					}}</Button>
				</div>
			</form>
			<ErrorMessage v-if="error" class="mt-2" :message="error" />

			<div v-if="open" class="mt-3.5 text-p-base">
				<template v-if="activity.activity_type === 'Lesson'">
					<div
						v-for="(point, i) in content.points || []"
						:key="i"
						class="mb-3 last:mb-0"
					>
						<div class="text-base font-medium text-ink-gray-8">
							{{ point.heading }}
						</div>
						<p class="text-ink-gray-7">{{ point.body }}</p>
						<SourceTag :source="point.source" />
					</div>
				</template>

				<template v-else-if="activity.activity_type === 'Scenario'">
					<p class="mb-3 text-ink-gray-8">{{ content.situation }}</p>
					<ul class="space-y-2">
						<li
							v-for="(choice, i) in content.choices || []"
							:key="i"
							class="rounded-5 border px-3 py-2"
							:class="
								choice.correct
									? 'border-outline-green-2 bg-surface-green-1'
									: 'border-outline-gray-1'
							"
						>
							<div class="flex items-center gap-2 text-ink-gray-8">
								<span
									v-if="choice.correct"
									class="lucide-check size-3.5 text-ink-green-6"
								/>
								{{ choice.text }}
							</div>
							<p class="mt-1 text-p-xs text-ink-gray-6">
								{{ choice.explanation }}
							</p>
						</li>
					</ul>
				</template>

				<dl
					v-else-if="activity.activity_type === 'Role-play'"
					class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 leading-relaxed"
				>
					<dt class="text-ink-gray-6">{{ content.character }}</dt>
					<dd class="text-ink-gray-8">
						{{ content.personality }}
					</dd>
					<dt class="text-ink-gray-6">{{ __('Setting') }}</dt>
					<dd class="text-ink-gray-8">{{ content.setting }}</dd>
					<dt class="text-ink-gray-6">{{ __('Their task') }}</dt>
					<dd class="text-ink-gray-8">{{ content.learner_task }}</dd>
					<dt class="text-ink-gray-6">{{ __('Opens with') }}</dt>
					<dd class="italic text-ink-gray-8">"{{ content.opening_line }}"</dd>
					<dt class="self-center text-ink-gray-6">{{ __('Length') }}</dt>
					<dd>
						<div class="w-36">
							<FormControl
								type="select"
								size="sm"
								:aria-label="__('Length')"
								:options="lengthOptions"
								:model-value="String(content.exchanges || 4)"
								@update:model-value="setExchanges"
							/>
						</div>
					</dd>
					<dt class="self-center text-ink-gray-6">
						{{ __('Passing percentage') }}
					</dt>
					<dd>
						<div class="w-36">
							<FormControl
								type="select"
								size="sm"
								:aria-label="__('Passing percentage')"
								:options="passMarkOptions"
								:model-value="String(content.pass_mark || 70)"
								@update:model-value="setPassMark"
							/>
						</div>
					</dd>
					<dt class="text-ink-gray-6">{{ __('What counts') }}</dt>
					<dd class="text-ink-gray-8">
						{{ (content.rubric || []).map((row) => row.criterion).join(' · ') }}
					</dd>
				</dl>

				<ol
					v-else-if="activity.activity_type === 'Check'"
					class="list-decimal space-y-3 ps-4"
				>
					<li v-for="(question, i) in content.questions || []" :key="i">
						<div class="text-ink-gray-8">{{ question.question }}</div>
						<ul class="mt-1 space-y-0.5">
							<li
								v-for="(option, j) in question.options"
								:key="j"
								class="flex items-center gap-1.5"
								:class="
									j === question.answer_index
										? 'text-ink-green-7'
										: 'text-ink-gray-6'
								"
							>
								<span
									class="size-3.5"
									:class="
										j === question.answer_index ? 'lucide-check' : 'lucide-dot'
									"
								/>
								{{ option }}
							</li>
						</ul>
						<SourceTag :source="question.source" />
					</li>
				</ol>
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { isCastKey, TUTOR_NAME, type CharacterKey } from '@/utils/characters'
import { Button, ErrorMessage, FormControl, LoadingIndicator } from 'frappe-ui'
import SourceTag from '@/components/Goals/SourceTag.vue'
import { activityIcon, activityLabel, type ActivityType } from '@/utils/goals'

interface Activity {
	activity_type: ActivityType
	title: string
	summary: string
	minutes: number
	content: Record<string, any>
}

const props = withDefaults(
	defineProps<{
		activity: Activity
		first: boolean
		last: boolean
		tutorFirst?: boolean
		checkQuestions?: number
		revising?: boolean
		error?: string | null
	}>(),
	{ tutorFirst: false, checkQuestions: 5, revising: false, error: null }
)
const emit = defineEmits<{
	change: []
	checkQuestions: [count: number]
	move: [step: number]
	remove: []
	revise: [request: string]
}>()

const open = ref(false)
const asking = ref(false)
const request = ref('')

const submitChange = () => {
	if (!request.value.trim()) return
	emit('revise', request.value.trim())
	asking.value = false
	request.value = ''
}
const content = computed(() => props.activity.content || {})

// Who leads the activity: Lumi teaches the lesson, a cast member plays the role-play.
const avatar = computed<CharacterKey | null>(() => {
	if (props.activity.activity_type === 'Lesson' && props.tutorFirst)
		return 'lumi'
	if (
		props.activity.activity_type === 'Role-play' &&
		isCastKey(content.value.cast)
	)
		return content.value.cast
	return null
})
const avatarLabel = computed(() =>
	avatar.value === 'lumi' ? TUTOR_NAME : content.value.character
)

const minutes = computed(() =>
	props.activity.minutes ? __('{0} min').format(props.activity.minutes) : ''
)
const meta = computed(() => {
	const type = props.activity.activity_type
	const parts: string[] = []
	if (type === 'Lesson') {
		parts.push(
			props.tutorFirst
				? __('Lesson with {0}').format(TUTOR_NAME)
				: activityLabel(type)
		)
		const ideas = (content.value.points || []).length
		if (ideas) parts.push(__('{0} key ideas').format(ideas))
		if (minutes.value) parts.push(minutes.value)
	} else if (type === 'Role-play') {
		parts.push(
			content.value.character
				? __('Role-play with {0}').format(content.value.character)
				: activityLabel(type)
		)
		parts.push(__('{0} replies').format(Number(content.value.exchanges || 4)))
		parts.push(
			__('passing percentage {0}%').format(content.value.pass_mark || 70)
		)
	} else {
		parts.push(activityLabel(type))
		if (minutes.value) parts.push(minutes.value)
	}
	return parts.join(' · ')
})

// How many times the learner replies in a role-play before it closes.
const lengthOptions = [2, 3, 4, 5, 6].map((n) => ({
	label: __('{0} replies').format(n),
	value: String(n),
}))
const setExchanges = (value: string) => {
	props.activity.content = { ...content.value, exchanges: Number(value) }
	emit('change')
}

// The score a role-play needs to pass; a mark set before this list still shows.
const passMarkOptions = computed(() =>
	[...new Set([50, 60, 70, 80, 90, Number(content.value.pass_mark || 70)])]
		.sort((a, b) => a - b)
		.map((n) => ({ label: __('{0}%').format(n), value: String(n) }))
)
const setPassMark = (value: string) => {
	props.activity.content = { ...content.value, pass_mark: Number(value) }
	emit('change')
}

// The final check's length; a count set before this list still shows.
const questionOptions = computed(() =>
	[...new Set([3, 4, 5, 6, 8, 10, Number(props.checkQuestions || 5)])]
		.sort((a, b) => a - b)
		.map((n) => ({ label: __('{0} questions').format(n), value: String(n) }))
)
</script>
