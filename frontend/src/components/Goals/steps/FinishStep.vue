<template>
	<div class="mx-auto w-full max-w-[640px]">
		<span
			class="flex size-11 items-center justify-center rounded-full"
			:class="ready ? 'bg-surface-green-1' : 'bg-surface-gray-2'"
			aria-hidden="true"
		>
			<span
				class="size-5"
				:class="
					ready
						? 'lucide-check text-ink-green-7'
						: 'lucide-flag text-ink-gray-7'
				"
			/>
		</span>
		<h1 class="mt-4 text-2xl-semibold text-ink-gray-9">{{ headline }}</h1>
		<p class="mt-2.5 text-p-base text-ink-gray-7">{{ lead }}</p>

		<div
			v-if="lumiNote"
			class="mt-7 flex gap-3 rounded-7 bg-surface-gray-1 p-3.5"
		>
			<CharacterAvatar who="lumi" class="size-8 shrink-0" />
			<div class="min-w-0">
				<div class="text-p-sm font-medium text-ink-gray-9">
					{{ TUTOR_NAME }}
				</div>
				<p class="mt-0.5 text-p-sm text-ink-gray-8">{{ lumiNote }}</p>
			</div>
		</div>

		<h2 class="mt-8 text-p-sm font-medium text-ink-gray-6">
			{{ __('How it went') }}
		</h2>
		<ul class="mt-2 divide-y divide-outline-gray-1">
			<li
				v-for="row in rows"
				:key="row.key"
				class="flex items-center justify-between gap-4 py-3 text-p-sm"
			>
				<button
					v-if="row.open !== undefined"
					type="button"
					class="text-start text-ink-gray-9 underline underline-offset-4 hover:text-ink-gray-7"
					@click="emit('open', row.open)"
				>
					{{ row.label }}
				</button>
				<span
					v-else
					:class="
						row.strong ? 'font-medium text-ink-gray-9' : 'text-ink-gray-9'
					"
					>{{ row.label }}</span
				>
				<span
					class="shrink-0 text-end"
					:class="
						row.strong ? 'font-medium text-ink-gray-9' : 'text-ink-gray-6'
					"
					>{{ row.value }}</span
				>
			</li>
			<li v-if="goal.proof_acknowledgement" class="py-3 text-p-sm">
				<div class="flex items-center justify-between gap-4">
					<span class="text-ink-gray-9">{{
						__('Confirm you understood')
					}}</span>
					<span class="shrink-0 text-ink-gray-6">{{
						requirements.acknowledgement
							? __('Confirmed on {0}').format(
									formatDate(assignment.acknowledged_on)
							  )
							: __('Not yet')
					}}</span>
				</div>
				<template v-if="!requirements.acknowledgement">
					<p class="mt-2 rounded-5 bg-surface-gray-1 p-3 text-ink-gray-7">
						{{ goal.acknowledgement_text }}
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-3">
						<Checkbox
							v-model="agreed"
							:label="__('I\'ve read and understood this')"
						/>
						<Button
							size="sm"
							variant="solid"
							:disabled="!agreed"
							:loading="saving"
							@click="acknowledge"
						>
							{{ __('Confirm') }}
						</Button>
					</div>
				</template>
			</li>
			<li
				v-if="goal.proof_sign_off"
				class="flex items-center justify-between gap-4 py-3 text-p-sm"
			>
				<span class="text-ink-gray-9">{{ __('Sign-off in person') }}</span>
				<span class="shrink-0 text-end text-ink-gray-6">{{
					requirements.sign_off
						? __('Signed off')
						: __('Someone will check this with you')
				}}</span>
			</li>
		</ul>

		<!-- Alpha: the finish is the one moment every tester reaches, so the team's questions live here. -->
		<section
			v-if="ready"
			class="mt-7 flex flex-col gap-8 border-t border-outline-gray-1 pt-7"
			aria-labelledby="alpha-feedback"
		>
			<div v-if="feedbackGiven || sent" class="flex items-center gap-2.5">
				<span class="lucide-check size-4 text-ink-green-7" aria-hidden="true" />
				<p class="text-p-sm text-ink-gray-7">
					{{ __('Thank you. Your answers are with the Frappe Learning team.') }}
				</p>
			</div>
			<template v-else>
				<div class="flex flex-col gap-1.5">
					<h2 id="alpha-feedback" class="text-lg-semibold text-ink-gray-9">
						{{ __("You're one of the first people to learn this way.") }}
					</h2>
					<p class="text-p-base text-ink-gray-7">
						{{
							__(
								'We would like to know how was your experience with this new way of learning.'
							)
						}}
					</p>
				</div>

				<fieldset class="flex flex-col">
					<legend class="mb-4 text-p-base font-medium text-ink-gray-9">
						{{ __('1. Is this how learning should feel in the future?') }}
					</legend>
					<div class="flex flex-wrap gap-2">
						<Button
							v-for="option in FUTURE"
							:key="option"
							size="md"
							variant="outline"
							:class="optionClass(answers.future === option)"
							:aria-pressed="answers.future === option"
							@click="answers.future = option"
						>
							{{ __(option) }}
						</Button>
					</div>
				</fieldset>

				<fieldset class="flex flex-col">
					<legend class="mb-4 text-p-base font-medium text-ink-gray-9">
						{{
							__(
								'2. Compared with traditional courses and training you usually get, this was'
							)
						}}
					</legend>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						<Button
							v-for="option in COMPARED"
							:key="option"
							size="md"
							variant="outline"
							:class="optionClass(answers.compared === option)"
							:aria-pressed="answers.compared === option"
							@click="answers.compared = option"
						>
							{{ __(option) }}
						</Button>
					</div>
				</fieldset>

				<div class="flex flex-col gap-4">
					<div class="text-p-base font-medium text-ink-gray-9">
						{{ __('3. Rate the parts') }}
					</div>
					<ul
						class="divide-y divide-outline-gray-1 rounded-7 border border-outline-gray-2"
					>
						<li
							v-for="part in PARTS"
							:key="part.key"
							class="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
						>
							<div class="min-w-0">
								<div class="text-p-base text-ink-gray-9">{{ part.label }}</div>
								<div class="text-p-xs text-ink-gray-6">{{ part.hint }}</div>
							</div>
							<Rating
								v-model="answers[part.key]"
								:max="5"
								size="md"
								:aria-label="part.label"
							/>
						</li>
					</ul>
					<div class="flex flex-col gap-2">
						<span class="text-p-sm text-ink-gray-6">{{
							__('About the voices')
						}}</span>
						<div class="flex flex-wrap gap-2">
							<Button
								v-for="note in VOICE_NOTES"
								:key="note"
								size="sm"
								variant="outline"
								:class="[
									'!rounded-full',
									optionClass(answers.voice_notes.includes(note)),
								]"
								:aria-pressed="answers.voice_notes.includes(note)"
								@click="toggleNote(note)"
							>
								{{ __(note) }}
							</Button>
						</div>
					</div>
				</div>

				<fieldset class="flex flex-col">
					<legend class="mb-4 text-p-base font-medium text-ink-gray-9">
						{{
							__(
								'4. Did Lumi get anything wrong, or say something you did not trust?'
							)
						}}
					</legend>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<Button
							v-for="option in TRUST"
							:key="option"
							size="md"
							variant="outline"
							:class="optionClass(answers.trust === option)"
							:aria-pressed="answers.trust === option"
							@click="answers.trust = option"
						>
							{{ __(option) }}
						</Button>
					</div>
				</fieldset>

				<fieldset class="flex flex-col">
					<legend class="mb-4 text-p-base font-medium text-ink-gray-9">
						{{
							__(
								'5. If your next mandatory training came both ways, which would you pick?'
							)
						}}
					</legend>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<Button
							v-for="option in NEXT"
							:key="option"
							size="md"
							variant="outline"
							:class="optionClass(answers.next_training === option)"
							:aria-pressed="answers.next_training === option"
							@click="answers.next_training = option"
						>
							{{ __(option) }}
						</Button>
					</div>
				</fieldset>

				<FormControl
					v-model="answers.words"
					type="textarea"
					variant="outline"
					:rows="4"
					:label="
						__(
							'6. In your own words: what should we keep, and what should we change?'
						)
					"
				/>

				<div>
					<Button
						variant="solid"
						size="md"
						:disabled="!answered"
						:loading="sending"
						@click="send"
					>
						{{ __('Submit') }}
					</Button>
				</div>
				<ErrorMessage :message="sendError" />
			</template>
		</section>

		<div v-if="ready && goal.proof_certificate" class="mt-7">
			<Button variant="solid" size="md" @click="showCertificate = true">
				{{ __('Get your certificate') }}
			</Button>
		</div>

		<Dialog
			v-model="showCertificate"
			:options="{ title: __('Your certificate'), size: 'md' }"
		>
			<template #body-content>
				<div class="rounded-7 border border-outline-gray-2 p-5">
					<div class="text-p-xs text-ink-gray-6">{{ __('Certificate') }}</div>
					<div class="mt-1 text-lg-semibold text-ink-gray-9">
						{{ goal.title }}
					</div>
					<div class="mt-0.5 text-p-sm text-ink-gray-7">{{ memberName }}</div>
					<div class="mt-3 text-p-xs text-ink-gray-6">
						{{ __('Completed on {0}').format(formatDate(assignment.ready_on)) }}
						<template v-if="goal.recurrence === 'Yearly'">
							· {{ __('valid for one year') }}</template
						>
					</div>
				</div>
			</template>
		</Dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
	Button,
	call,
	Checkbox,
	Dialog,
	ErrorMessage,
	FormControl,
	Rating,
} from 'frappe-ui'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { TUTOR_NAME } from '@/utils/characters'
import dayjs from '@/utils/dayjs'

type Row = {
	key: string
	label: string
	value: string
	open?: number
	strong?: boolean
}

const props = defineProps<{
	goal: Record<string, any>
	assignment: Record<string, any>
	requirements: Record<string, boolean>
	memberName: string
	activities: Record<string, any>[]
	ideas: Record<string, any>[]
	/** Whether this tester already sent the team their answers. */
	feedbackGiven?: boolean
}>()
const emit = defineEmits<{
	changed: [state: Record<string, unknown>]
	open: [index: number]
}>()

const agreed = ref(false)
const saving = ref(false)
const showCertificate = ref(false)
const ready = computed(() => props.assignment.status === 'Ready')

// The alpha questions. The stored values are these English strings, which match the
// doctype's Select options; the screen shows them translated.
const FUTURE = [
	'Yes, this is it',
	'Right idea, rough edges',
	'Not sure yet',
	'No, I like traditional courses',
]
const COMPARED = ['Worse', 'About the same', 'Better', 'Much better']
const PARTS = [
	{
		key: 'teaching',
		label: __("Lumi's teaching"),
		hint: __('The lesson, the way it explained and checked'),
	},
	{
		key: 'roleplay',
		label: __('The role-play'),
		hint: __('Did the other person feel real?'),
	},
	{
		key: 'voices',
		label: __('The voices'),
		hint: __('Lumi and the role-play speaking out loud'),
	},
] as const
const VOICE_NOTES = [
	'Sounded natural',
	'Too slow',
	'Hard to hear',
	'Very robotic',
	"I'd rather read",
]
const TRUST = ['No, all of it held up', 'Once or twice', 'Often']
const NEXT = ['This, with Lumi', 'The usual course', 'Not sure yet']

const answers = reactive({
	future: '',
	compared: '',
	teaching: 0,
	roleplay: 0,
	voices: 0,
	voice_notes: [] as string[],
	trust: '',
	next_training: '',
	words: '',
})
const optionClass = (on: boolean) =>
	on
		? '!font-normal !border-outline-gray-4 !text-ink-gray-9'
		: '!font-normal !border-outline-gray-1'
const sending = ref(false)
const sent = ref(false)
const sendError = ref('')
// One answer is enough to send; the rest can stay blank.
const answered = computed(
	() =>
		Boolean(
			answers.future ||
				answers.compared ||
				answers.trust ||
				answers.next_training
		) ||
		answers.teaching + answers.roleplay + answers.voices > 0 ||
		Boolean(answers.words.trim())
)
const toggleNote = (note: string) => {
	const at = answers.voice_notes.indexOf(note)
	if (at === -1) answers.voice_notes.push(note)
	else answers.voice_notes.splice(at, 1)
}
const send = async () => {
	sending.value = true
	sendError.value = ''
	try {
		await call('lms.lms.ai.api.submit_alpha_feedback', {
			assignment: props.assignment.name,
			values: {
				...answers,
				voice_notes: answers.voice_notes.join(', '),
			},
		})
		sent.value = true
	} catch (error) {
		console.error(error)
		sendError.value = __('Could not send your answers. Try again.')
	} finally {
		sending.value = false
	}
}
const left = computed(() => props.activities.filter((a) => !a.done))
const score = computed(() => Math.round(props.assignment.score || 0))

const headline = computed(() => {
	if (ready.value) return __("You're ready for {0}.").format(props.goal.title)
	if (left.value.length) return __('Almost there')
	return __('Not quite there yet')
})

// The outcome is written for the start ("By the end, you'll be able to…");
// read at the finish, it flips into the present.
const outcomeNow = computed(() =>
	(props.goal.outcome || '').replace(
		/^by the end,? you('|’)ll be able to\s*/i,
		__('You can now') + ' '
	)
)

const lead = computed(() => {
	if (ready.value) return outcomeNow.value
	if (left.value.length)
		return left.value.length === 1
			? __('Finish {0} to complete this skill.').format(left.value[0].title)
			: __('Finish the {0} parts left to complete this skill.').format(
					left.value.length
			  )
	if (!props.requirements.mastery)
		return __(
			'You scored {0}%. The passing percentage is {1}%. Try a part again to raise your score.'
		).format(score.value, props.goal.mastery_threshold)
	if (!props.requirements.acknowledgement)
		return __('Confirm you understood below to finish.')
	return __('Someone will sign this off with you in person to finish.')
})

const lumiNote = computed(() => {
	if (!props.goal.tutor_first) return ''
	const lesson = props.activities.find((a) => a.activity_type === 'Lesson')
	return lesson?.evidence?.status === 'Graded' ? lesson.evidence.feedback : ''
})

const resultOf = (activity: Record<string, any>) => {
	const evidence = activity.evidence
	if (!activity.done || !evidence || evidence.status !== 'Graded')
		return __('Not done yet')
	const marks = evidence.response?.marks
	if (Array.isArray(marks) && marks.length)
		return __('{0} of {1}').format(
			marks.filter((m: Record<string, any>) => m.correct).length,
			marks.length
		)
	return `${Math.round(evidence.score || 0)}%`
}

const rows = computed<Row[]>(() => {
	const list: Row[] = []
	if (props.goal.tutor_first && props.ideas.length) {
		const confirmed = props.ideas.filter((i) => i.confirmed).length
		const taught = props.ideas.filter((i) => i.taught).length
		list.push({
			key: 'ideas',
			label: __('Key ideas'),
			// "Understood" says what the count means; the ideas Lumi had to teach are the
			// ones that were new to them.
			value: [
				confirmed === props.ideas.length
					? __('All {0} understood').format(confirmed)
					: __('{0} of {1} understood').format(confirmed, props.ideas.length),
				taught ? __('{0} new to you').format(taught) : '',
			]
				.filter(Boolean)
				.join(' · '),
		})
	}
	for (const activity of props.activities) {
		if (activity.activity_type === 'Lesson') continue
		list.push({
			key: `activity-${activity.index}`,
			label: activity.title,
			value: resultOf(activity),
			open: activity.activity_type === 'Role-play' ? activity.index : undefined,
		})
	}
	if (props.goal.proof_mastery)
		list.push({
			key: 'score',
			label: __('Your score'),
			value: `${score.value}%`,
			strong: true,
		})
	return list
})

const formatDate = (value?: string) =>
	value ? dayjs(value).format('D MMM YYYY') : ''

const acknowledge = async () => {
	saving.value = true
	try {
		emit(
			'changed',
			await call('lms.lms.ai.api.acknowledge', {
				assignment: props.assignment.name,
			})
		)
	} finally {
		saving.value = false
	}
}
</script>
