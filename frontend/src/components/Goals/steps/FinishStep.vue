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

		<div class="mt-7 flex flex-wrap gap-2.5">
			<Button
				v-if="ready && goal.proof_certificate"
				variant="solid"
				size="md"
				@click="showCertificate = true"
			>
				{{ __('Get your certificate') }}
			</Button>
			<Button
				size="md"
				:variant="ready && goal.proof_certificate ? 'subtle' : 'solid'"
				@click="router.push({ name: 'Home' })"
			>
				{{ __('Back to home') }}
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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, call, Checkbox, Dialog } from 'frappe-ui'
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
}>()
const emit = defineEmits<{
	changed: [state: Record<string, unknown>]
	open: [index: number]
}>()

const router = useRouter()
const agreed = ref(false)
const saving = ref(false)
const showCertificate = ref(false)
const ready = computed(() => props.assignment.status === 'Ready')
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
			value: taught
				? __('{0} of {1}, {2} learned here').format(
						confirmed,
						props.ideas.length,
						taught
				  )
				: __('{0} of {1}').format(confirmed, props.ideas.length),
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
