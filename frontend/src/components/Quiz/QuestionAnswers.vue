<template>
	<div v-if="isChoice(uiType)" ref="choiceSection">
		<div class="space-y-2" ref="choiceRows" data-testid="answer-rows">
			<div v-for="n in options.count" :key="n" class="flex gap-3">
				<div class="flex h-8 w-5 shrink-0 items-center justify-center">
					<input
						v-if="uiType === 'single'"
						type="radio"
						:class="RADIO_CLASSES"
						:name="correctAnswerGroup"
						:checked="!!question[`is_correct_${n}`]"
						:aria-label="__('Option {0} is the correct answer').format(n)"
						:aria-invalid="correctAnswerInvalid || undefined"
						:aria-describedby="
							correctAnswerInvalid ? correctAnswerMessageId : undefined
						"
						@change="setSingleCorrect(n)"
					/>
					<Checkbox
						v-else
						size="md"
						:model-value="!!question[`is_correct_${n}`]"
						:aria-label="__('Option {0} is a correct answer').format(n)"
						:aria-invalid="correctAnswerInvalid || undefined"
						:aria-describedby="
							correctAnswerInvalid ? correctAnswerMessageId : undefined
						"
						@update:model-value="toggleCorrect(n, $event)"
					/>
				</div>
				<div class="min-w-0 flex-1 space-y-1.5">
					<FormControl
						:class="[options.invalid(n) ? INVALID_INPUT_CLASS : null]"
						variant="outline"
						v-model="question[`option_${n}`]"
						:required="options.isRequired(n)"
						:aria-invalid="options.invalid(n) || undefined"
						:aria-label="__('Option {0}').format(n)"
						:placeholder="__('Option {0}').format(n)"
						@blur="options.touch(n)"
					/>
					<FormControl
						variant="outline"
						v-model="question[`explanation_${n}`]"
						:aria-label="__('Explanation for option {0}').format(n)"
						:placeholder="
							__(
								'Explanation for option {0}, shown as feedback (optional)'
							).format(n)
						"
					/>
				</div>
				<Button
					v-if="options.removable"
					class="shrink-0"
					variant="ghost"
					icon="lucide-x"
					:label="__('Remove option {0}').format(n)"
					@click="options.remove(n)"
				/>
			</div>
		</div>
		<p
			v-if="correctAnswerInvalid"
			:id="correctAnswerMessageId"
			class="mt-2 flex items-center gap-1.5 text-p-sm text-ink-red-6"
		>
			<span class="lucide-circle-alert size-4 shrink-0" />
			{{
				uiType === 'single'
					? __('Mark the correct answer')
					: __('Mark at least two correct answers')
			}}
		</p>
		<Button
			v-if="options.canAdd"
			class="mt-2"
			variant="outline"
			@click="options.add()"
		>
			<template #prefix><span class="lucide-plus size-4" /></template>
			{{ __('Add option') }}
			<span class="ms-2 text-ink-gray-6"
				>{{ options.count }}/{{ MAX_OPTIONS }}</span
			>
		</Button>
	</div>

	<div v-else-if="uiType === 'user_input'" ref="inputSection">
		<div class="space-y-2" ref="inputRows">
			<div
				v-for="n in possibilities.count"
				:key="n"
				class="flex items-center gap-3"
			>
				<div class="flex w-5 shrink-0 items-center justify-center">
					<Checkbox
						size="md"
						class="pointer-events-none"
						tabindex="-1"
						aria-hidden="true"
						:model-value="true"
					/>
				</div>
				<FormControl
					:class="[
						'flex-1',
						possibilities.invalid(n) ? INVALID_INPUT_CLASS : null,
					]"
					variant="outline"
					v-model="question[`possibility_${n}`]"
					:required="possibilities.isRequired(n)"
					:aria-invalid="possibilities.invalid(n) || undefined"
					:aria-label="__('Accepted answer {0}').format(n)"
					:placeholder="__('Accepted answer {0}').format(n)"
					@blur="possibilities.touch(n)"
				/>
				<Button
					v-if="possibilities.removable"
					variant="ghost"
					icon="lucide-x"
					:label="__('Remove answer {0}').format(n)"
					@click="possibilities.remove(n)"
				/>
			</div>
		</div>
		<div class="mt-2 flex items-center gap-2">
			<Button
				v-if="possibilities.canAdd"
				variant="outline"
				@click="possibilities.add()"
			>
				<template #prefix><span class="lucide-plus size-4" /></template>
				{{ __('Add accepted answer') }}
				<span class="ms-2 text-ink-gray-6"
					>{{ possibilities.count }}/{{ MAX_OPTIONS }}</span
				>
			</Button>
			<Button variant="ghost" :label="gradingHint" :tooltip="gradingHint">
				<template #icon>
					<span class="lucide-help-circle size-4 shrink-0 text-ink-gray-5" />
				</template>
			</Button>
		</div>
	</div>
</template>

<script setup>
import { Button, Checkbox, FormControl } from 'frappe-ui'
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import {
	MAX_OPTIONS,
	REQUIRED_OPTIONS,
	REQUIRED_POSSIBILITIES,
	blankOptionFields,
	hasRequiredCorrectOptions,
	hasRequiredOptions,
	hasRequiredPossibilities,
	isChoice,
} from '@/utils/quizQuestion'

// Verbatim from frappe-ui Checkbox's inputClasses (md, enabled), minus its rounded-sm.
const RADIO_CLASSES =
	'mt-[1px] h-4 w-4 bg-surface-base border-outline-gray-4 text-ink-gray-9 transition hover:border-outline-gray-7 hover:shadow-sm focus:border-outline-gray-8 focus:ring-0 focus:ring-offset-0 active:border-outline-gray-6 active:bg-surface-gray-2'

// frappe-ui's error prop leaves the border grey, and its class lands on the wrapper.
const INVALID_INPUT_CLASS = '[&_input]:!border-outline-red-3'

const props = defineProps({
	uiType: { type: String, required: true },
	question: { type: Object, required: true },
	// A stored question arrives invalid through nobody's fault, so it says so at once.
	revealErrors: { type: Boolean, default: false },
})

const gradingHint = __('Auto-graded by fuzzy match > 85% · up to 10')

// Native radios group by name, so two open cards would share one selection.
const correctAnswerGroup = useId()
const correctAnswerMessageId = useId()

// Blur, not mount or first keystroke. Keyed by fieldname so remove can shift it.
const touched = reactive({})
const markTouched = (field) => {
	touched[field] = true
}
const revealed = (field) => props.revealErrors || Boolean(touched[field])

const isBlank = (value) => !String(value ?? '').trim()

// A question stores answers as flat numbered fields, so choices and accepted
// answers differ only in the prefix and the minimum. `missing` is the gate's
// own predicate, so nothing goes red that Save accepts.
const choiceRows = ref(null)
const choiceSection = ref(null)
const inputRows = ref(null)
const inputSection = ref(null)

const answerRows = ({
	prefix,
	minimum,
	companions = [],
	missing,
	rows,
	section,
}) => {
	const fields = [prefix, ...companions]
	const blanks = blankOptionFields()
	const count = ref(minimum)
	const isRequired = (n) => n <= minimum

	return reactive({
		count,
		isRequired,
		canAdd: computed(() => count.value < MAX_OPTIONS),
		removable: computed(() => count.value > minimum),
		touch: (n) => markTouched(`${prefix}_${n}`),
		invalid: (n) =>
			isRequired(n) &&
			missing() &&
			isBlank(props.question[`${prefix}_${n}`]) &&
			revealed(`${prefix}_${n}`),
		// How many rows to show, derived from the populated fields on the working copy.
		sync: () => {
			count.value = Math.max(
				minimum,
				...Array.from({ length: MAX_OPTIONS }, (_, i) =>
					props.question[`${prefix}_${i + 1}`] ? i + 1 : 0
				)
			)
		},
		add: async () => {
			if (count.value >= MAX_OPTIONS) return
			count.value++
			// The dialog holds this in a fixed-height box, so a new row can land under
			// the bottom edge. Row first, then the Add control: the last scroll wins,
			// and the control unmounts at MAX_OPTIONS while the row never does.
			await nextTick()
			rows?.value?.lastElementChild?.scrollIntoView({ block: 'nearest' })
			const addControl = section?.value?.lastElementChild
			if (addControl && addControl !== rows?.value)
				addControl.scrollIntoView({ block: 'nearest' })
		},
		remove: (pos) => {
			if (count.value <= minimum) return
			for (let n = pos; n < count.value; n++) {
				for (const field of fields)
					props.question[`${field}_${n}`] = props.question[`${field}_${n + 1}`]
				touched[`${prefix}_${n}`] = touched[`${prefix}_${n + 1}`]
			}
			for (const field of fields) {
				const last = `${field}_${count.value}`
				props.question[last] = blanks[last]
			}
			touched[`${prefix}_${count.value}`] = false
			count.value--
		},
	})
}

const options = answerRows({
	prefix: 'option',
	minimum: REQUIRED_OPTIONS,
	companions: ['is_correct', 'explanation'],
	missing: () => !hasRequiredOptions(props.question),
	rows: choiceRows,
	section: choiceSection,
})
const possibilities = answerRows({
	prefix: 'possibility',
	minimum: REQUIRED_POSSIBILITIES,
	missing: () => !hasRequiredPossibilities(props.question),
	rows: inputRows,
	section: inputSection,
})

watch(
	() => props.question,
	() => {
		options.sync()
		possibilities.sync()
	},
	{ immediate: true }
)

// A radio nobody clicks is never blurred, so any blurred option arms the group.
const anyRequiredOptionTouched = computed(() =>
	Array.from(
		{ length: REQUIRED_OPTIONS },
		(_, i) => touched[`option_${i + 1}`]
	).some(Boolean)
)
const correctAnswerInvalid = computed(
	() =>
		isChoice(props.uiType) &&
		!hasRequiredCorrectOptions(props.question, props.uiType) &&
		(props.revealErrors || anyRequiredOptionTouched.value)
)

const setSingleCorrect = (n) => {
	for (let i = 1; i <= MAX_OPTIONS; i++)
		props.question[`is_correct_${i}`] = i === n ? 1 : 0
}

// Switching multiple to single left every flag the author had already ticked, and
// validate_correct_options reads the count back off them and makes it multiple
// again on save, so the stored question disagrees with the type on screen.
watch(
	() => props.uiType,
	(type) => {
		if (type !== 'single') return
		const first = Array.from({ length: MAX_OPTIONS }, (_, i) => i + 1).find(
			(n) => props.question[`is_correct_${n}`]
		)
		if (first) setSingleCorrect(first)
	}
)
const toggleCorrect = (n, checked) => {
	props.question[`is_correct_${n}`] = checked ? 1 : 0
}
</script>
