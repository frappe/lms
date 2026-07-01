<template>
	<div class="relative mx-auto w-full max-w-2xl">
		<div class="flex min-h-[22rem] flex-col">
			<div class="flex items-center justify-between">
				<span
					class="text-xs font-medium uppercase tracking-wide text-ink-gray-5"
				>
					{{ labels.progress(current + 1, total) }}
				</span>
				<span
					class="text-xs font-medium uppercase tracking-wide text-ink-gray-5"
				>
					{{ labels.complete(percent) }}
				</span>
			</div>
			<div
				class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-gray-3"
			>
				<div
					class="h-full rounded-full transition-all duration-500 ease-out"
					:class="accentClasses.bar"
					:style="{ width: `${percent}%` }"
				/>
			</div>

			<Transition name="q-fade" mode="out-in" @after-enter="focusQuestion">
				<fieldset
					:key="question.key"
					tabindex="-1"
					class="mt-6 mx-0 min-w-0 border-0 p-0 focus:outline-none"
				>
					<legend class="p-0 text-xl font-semibold text-ink-gray-9">
						{{ question.title }}
					</legend>
					<div class="mt-5 flex flex-wrap gap-2.5">
						<label
							v-for="option in question.options"
							:key="String(option.value)"
							class="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-outline-gray-3 focus-within:ring-offset-1"
							:class="
								answers[question.key] === option.value
									? accentClasses.selected
									: 'border-outline-gray-2 bg-surface-white text-ink-gray-8 hover:border-outline-gray-3 hover:bg-surface-gray-2'
							"
						>
							<input
								type="radio"
								class="sr-only"
								:name="question.key"
								:value="option.value"
								:checked="answers[question.key] === option.value"
								@change="select(option)"
								@click="
									answers[question.key] === option.value && select(option)
								"
							/>
							{{ option.label }}
						</label>
					</div>
				</fieldset>
			</Transition>
		</div>

		<button
			v-if="current > 0"
			type="button"
			class="absolute right-full top-1/3 mr-4 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg border border-outline-gray-2 bg-surface-white p-1.5 text-sm font-medium text-ink-gray-7 transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 focus-visible:ring-offset-1"
			@click="back"
			:aria-label="labels.back"
		>
			<LucideChevronLeft class="size-4" />
		</button>

		<button
			v-if="answered && current < total - 1"
			type="button"
			class="absolute left-full top-1/3 ml-4 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg border border-outline-gray-2 bg-surface-white p-1.5 text-sm font-medium text-ink-gray-7 transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 focus-visible:ring-offset-1"
			@click="next"
			:aria-label="labels.next"
		>
			<LucideChevronRight class="size-4" />
		</button>

		<button
			v-if="showSkip"
			type="button"
			class="mx-auto mt-6 block text-sm text-ink-gray-5 transition-colors hover:text-ink-gray-7"
			@click="emit('skip')"
		>
			{{ labels.skip }}
		</button>
	</div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
	questions: {
		type: Array,
		required: true,
	},
	accent: {
		type: String,
		default: 'black',
	},
	showSkip: {
		type: Boolean,
		default: true,
	},
	labels: {
		type: Object,
		default: () => ({}),
	},
})

const emit = defineEmits(['submit', 'skip'])

const ACCENTS = {
	black: {
		selected:
			'border-transparent bg-surface-gray-10 text-ink-base hover:bg-surface-gray-9 focus-visible:ring-outline-gray-3',
		bar: 'bg-surface-gray-10',
	},
	green: {
		selected:
			'border-transparent bg-surface-green-3 text-ink-base hover:bg-green-700 focus-visible:ring-outline-green-3',
		bar: 'bg-surface-green-3',
	},
	blue: {
		selected:
			'border-transparent bg-blue-500 text-ink-base hover:bg-surface-blue-3 focus-visible:ring-outline-blue-3',
		bar: 'bg-blue-500',
	},
	red: {
		selected:
			'border-transparent bg-surface-red-7 text-ink-base hover:bg-surface-red-8 focus-visible:ring-outline-red-3',
		bar: 'bg-surface-red-7',
	},
}

const labels = computed(() => ({
	progress: (n, total) => __('Question {0} of {1}').format(n, total),
	complete: (pct) => __('{0}% complete').format(pct),
	back: __('Back to previous question'),
	next: __('Next question'),
	skip: __('Skip for now'),
	...props.labels,
}))
const accentClasses = computed(() => ACCENTS[props.accent] ?? ACCENTS.black)

const current = ref(0)
const completed = ref(false)
const answers = reactive({})

const total = computed(() => props.questions.length)
const question = computed(() => props.questions[current.value])
const percent = computed(() => {
	if (completed.value) return 100
	return total.value ? Math.floor((current.value / total.value) * 100) : 0
})

const answered = computed(() => answers[question.value.key] !== undefined)

function advance() {
	if (current.value >= total.value - 1) {
		// Fill to 100% and hold a beat before handing off.
		completed.value = true
		setTimeout(() => emit('submit', { ...answers }), 700)
	} else {
		current.value += 1
	}
}

function select(option) {
	if (completed.value) return
	answers[question.value.key] = option.value
	advance()
}

function next() {
	if (completed.value || !answered.value) return
	advance()
}

function back() {
	if (completed.value) return
	if (current.value > 0) current.value -= 1
}

function focusQuestion(el) {
	el.focus()
}
</script>

<style scoped>
.q-fade-enter-active,
.q-fade-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}
.q-fade-enter-from {
	opacity: 0;
	transform: translateY(6px);
}
.q-fade-leave-to {
	opacity: 0;
	transform: translateY(-6px);
}
</style>
