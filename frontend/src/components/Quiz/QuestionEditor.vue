<template>
	<div
		class="flex items-center justify-between gap-3"
		:class="padded ? 'px-4 pt-4 pb-1' : ''"
	>
		<div class="flex items-center gap-2">
			<span v-if="typeLocked" :id="typeLockHintId" class="sr-only">
				{{ typeLockReason }}
			</span>
			<Dropdown v-if="!typeLocked" :options="typeMenu">
				<Button variant="outline">
					<template #prefix
						><span :class="[currentType.icon, 'size-4']"
					/></template>
					{{ currentType.label }}
					<template #suffix
						><span class="lucide-chevron-down size-4"
					/></template>
				</Button>
			</Dropdown>
			<Button
				v-else
				variant="outline"
				disabled
				:aria-describedby="typeLockHintId"
				:title="typeLockReason"
			>
				<template #prefix
					><span :class="[currentType.icon, 'size-4']"
				/></template>
				{{ currentType.label }}
				<template #suffix><span class="lucide-lock size-4" /></template>
			</Button>
			<div v-if="marksCustom" ref="marksBoxRef" class="marks-input w-28">
				<FormControl
					type="number"
					variant="outline"
					min="1"
					step="1"
					:modelValue="marksInput"
					:aria-label="__('Marks')"
					@update:modelValue="(val) => (marksInput = val)"
					@keydown.enter.prevent="commitMarks"
					@keydown.esc.prevent="cancelMarks"
					@blur="commitMarks"
				>
					<template #suffix>
						<span class="text-ink-gray-5">{{ marksUnit }}</span>
					</template>
				</FormControl>
			</div>
			<Dropdown v-else :options="marksMenu">
				<Button variant="outline">
					<template #prefix><span class="lucide-gauge size-4" /></template>
					{{ marksLabel(question.marks) }}
					<template #suffix
						><span class="lucide-chevron-down size-4"
					/></template>
				</Button>
			</Dropdown>
			<span v-if="usageCount > 1" class="shrink-0">
				<Badge theme="amber" variant="subtle">
					{{ __('Used in {0} quizzes').format(usageCount) }}
				</Badge>
			</span>
		</div>
		<slot name="actions" />
	</div>

	<div
		class="space-y-2"
		:class="[padded ? 'px-4 pb-4' : 'pt-4', fillsHeight ? COLUMN : '']"
	>
		<div class="space-y-1.5" :class="fillsHeight ? COLUMN : ''">
			<div :id="questionLabelId" class="sr-only">
				<FormLabel
					:id="questionEditorId"
					size="md"
					:label="__('Question')"
					:required="true"
				/>
			</div>
			<TextEditor
				ref="questionEditorRef"
				:class="fillsHeight ? `${COLUMN} fills-height` : ''"
				:content="question.question"
				@change="(val) => (question.question = val)"
				:editable="true"
				:fixedMenu="true"
				:placeholder="__('Type your question here')"
				:editorClass="editorClass"
			/>
		</div>
		<QuestionAnswers
			:key="answersKey"
			:class="fillsHeight ? 'shrink-0' : ''"
			:uiType="uiType"
			:question="question"
			:revealErrors="revealErrors"
		/>
	</div>
</template>

<script setup>
import {
	TextEditor,
	Button,
	Badge,
	Dropdown,
	FormControl,
	FormLabel,
} from 'frappe-ui'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QuestionAnswers from './QuestionAnswers.vue'
import {
	hasContent,
	QUESTION_TYPES,
	uiTypeMeta,
	marksLabel,
} from '@/utils/quizQuestion'

const props = defineProps({
	// Mutated in place: the owner holds the working copy and decides what to do with it.
	question: { type: Object, required: true },
	uiType: { type: String, required: true },
	// Which ui types this editor may offer. Empty, or the full list, means no restriction.
	allowedUiTypes: { type: Array, default: () => [] },
	revealErrors: { type: Boolean, default: false },
	usageCount: { type: Number, default: 1 },
	// The card pads the editor itself; a dialog brings its own padding.
	padded: { type: Boolean, default: true },
	// Let the question field take the height an owner has given the editor.
	// Options take what they need and the field absorbs the rest, so a
	// fixed-height owner has no slack left to show as a gap.
	fillHeight: { type: Boolean, default: false },
	// Every id below is built off this, so two editors on one page stay distinct.
	idPrefix: { type: String, required: true },
	// Remounts the answer editor when the owner reloads the question underneath it.
	answersKey: { type: [String, Number], default: '' },
})
const emit = defineEmits(['update:uiType'])

// Every ancestor has to be a flex column or `flex-1` on the field measures
// against nothing. No `min-h-0`: it let ancestors shrink past the field's own
// floor, so the toolbar and question text rendered on top of the options.
const COLUMN = 'flex flex-1 flex-col'
const fillsHeight = computed(() => props.fillHeight)

const questionEditorRef = ref(null)
// Up here because resetTouched() runs from the owner, which can call it during setup.
const editorTouched = ref(false)
const questionEditorId = computed(() => `question-editor-${props.idPrefix}`)
const questionLabelId = computed(
	() => `question-editor-label-${props.idPrefix}`
)

const currentType = computed(() => uiTypeMeta(props.uiType))

// No visible label any more, so emptiness shows as a red border, off the same test as isValid.
const questionMissing = computed(() => !hasContent(props.question.question))
const questionInvalid = computed(
	() => questionMissing.value && (props.revealErrors || editorTouched.value)
)

// The shadow belongs to the field, never the card, or focus stacks two of them.
// Progression copied from TextInput.vue's outline variant, with red swapped in for invalid.
const editorClass = computed(() => [
	'prose-sm max-w-none border-b border-x bg-surface-base rounded-b-md py-2 px-3 transition-colors',
	fillsHeight.value ? 'flex-1 overflow-y-auto min-h-[6rem]' : 'min-h-[5rem]',
	questionInvalid.value
		? 'border-outline-red-3 hover:border-outline-red-3 hover:shadow-sm focus-within:border-outline-red-4 focus-within:shadow-sm'
		: 'border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm',
])

// Touched means focused and left. The listener sits on the ProseMirror node, which takes focus.
const markEditorTouched = () => {
	editorTouched.value = true
}
let blurBoundTo = null
const unbindEditorBlur = () => {
	if (!blurBoundTo) return
	blurBoundTo.removeEventListener('blur', markEditorTouched)
	blurBoundTo = null
}
const bindEditorBlur = (dom) => {
	if (blurBoundTo === dom) return
	unbindEditorBlur()
	dom.addEventListener('blur', markEditorTouched)
	blurBoundTo = dom
}

// TextEditor puts fallthrough attrs on its wrapper, so label the ProseMirror node by hand.
const wireEditorLabel = () => {
	const dom = questionEditorRef.value?.editor?.view?.dom
	if (!dom) return
	dom.setAttribute('id', questionEditorId.value)
	dom.setAttribute('aria-labelledby', questionLabelId.value)
	// A statement about the field, not an error, so it is unconditional.
	dom.setAttribute('aria-required', 'true')
	dom.setAttribute('aria-invalid', questionInvalid.value ? 'true' : 'false')
	bindEditorBlur(dom)
}

onMounted(() => nextTick(wireEditorLabel))
onBeforeUnmount(unbindEditorBlur)

// The red border cannot be the only signal, and this node is written imperatively.
watch(questionInvalid, () => wireEditorLabel())

// Type switch.
const allowedTypes = computed(() => {
	const allowed = props.allowedUiTypes
	if (!allowed?.length) return QUESTION_TYPES
	const filtered = QUESTION_TYPES.filter((t) => allowed.includes(t.value))
	return filtered.length ? filtered : QUESTION_TYPES
})
const typeLocked = computed(() => allowedTypes.value.length === 1)
const typeLockReason = computed(() =>
	__('A quiz cannot mix Open Ended questions with other question types.')
)
// A disabled control fires no tooltip, so the reason is sr-only and tied on with aria-describedby.
const typeLockHintId = computed(() => `question-type-lock-${props.idPrefix}`)
const typeMenu = computed(() =>
	allowedTypes.value.map((t) => ({
		label: t.label,
		icon: t.icon,
		onClick: () => emit('update:uiType', t.value),
	}))
)

// Marks: a 1..10 dropdown, or an inline field for anything else.
const marksCustom = ref(false)
const marksInput = ref('')
const marksBoxRef = ref(null)

const setMarks = (m) => {
	props.question.marks = m
}

const marksMenu = computed(() => {
	const items = Array.from({ length: 10 }, (_, i) => ({
		label: marksLabel(i + 1),
		onClick: () => setMarks(i + 1),
	}))
	items.push({ label: __('Custom…'), onClick: openMarksInput })
	return items
})

// The suffix annotates whatever is currently typed, so it has to agree with it.
const marksUnit = computed(() =>
	Number(marksInput.value) === 1 ? __('mark') : __('marks')
)

const openMarksInput = () => {
	marksInput.value = String(props.question.marks)
	marksCustom.value = true
	nextTick(() => {
		const input = marksBoxRef.value?.querySelector('input')
		input?.focus()
		input?.select?.()
	})
}

// A stray blur racing the unmount would commit the value Escape just cancelled.
const commitMarks = () => {
	if (!marksCustom.value) return
	const val = Number(marksInput.value)
	// Integers only: both marks columns are Int, so 2.5 displayed as entered, fed
	// calculateTotalMarks a fraction, and then stored as 2.
	if (Number.isInteger(val) && val > 0) setMarks(val)
	marksCustom.value = false
}

const cancelMarks = () => {
	marksCustom.value = false
}

defineExpose({
	// Freshly loaded or freshly saved, so the author has not had their turn at it yet.
	resetTouched: () => {
		editorTouched.value = false
	},
	focus: () => {
		questionEditorRef.value?.editor?.commands?.focus('end')
	},
})
</script>

<style scoped>
/* Chrome renders number spinners at the inline end of the field, on top of the
   "marks" suffix. Firefox needs the -moz property for the same reason. */
.marks-input :deep(input[type='number'])::-webkit-outer-spin-button,
.marks-input :deep(input[type='number'])::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}
.marks-input :deep(input[type='number']) {
	-moz-appearance: textfield;
	appearance: textfield;
}

/* tiptap's EditorContent renders an unstyled wrapper div between TextEditor's
   root and the ProseMirror node, so `flex-1` on the field measured against a
   content-height box. @tiptap/vue-3 does not resolve here, so no #editor slot. */
.fills-height :deep(div:has(> .ProseMirror)) {
	display: flex;
	flex: 1 1 auto;
	flex-direction: column;
}
</style>
