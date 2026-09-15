<template>
	<div
		v-if="!isEditing"
		:id="`question-card-${row.name}`"
		class="relative flex items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-base px-4 py-3 transition-colors hover:border-outline-gray-3 focus-within:border-outline-gray-4"
	>
		<button
			v-if="!readOnly"
			type="button"
			class="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			:aria-label="__('Edit question {0}').format(index + 1)"
			@click="emit('edit')"
		/>
		<span
			class="lucide-grip-vertical relative z-10 size-4 shrink-0"
			:class="
				reorderDisabled || readOnly
					? 'text-ink-gray-3 opacity-50 cursor-not-allowed'
					: 'text-ink-gray-4 cursor-grab drag-handle'
			"
		/>
		<span
			class="shrink-0 size-5 rounded flex items-center justify-center bg-surface-gray-2 text-ink-gray-7 text-xs"
			>{{ index + 1 }}</span
		>
		<div
			v-if="strippedQuestionDetail"
			class="min-w-0 flex-1 truncate text-p-base-medium text-ink-gray-9"
		>
			{{ strippedQuestionDetail }}
		</div>
		<div
			v-else
			class="min-w-0 flex-1 truncate text-p-base-medium italic text-ink-gray-6"
		>
			{{ __('Untitled question') }}
		</div>
		<span
			class="min-w-0 overflow-hidden sm:min-w-[7.5rem] sm:shrink-0 sm:overflow-visible"
		>
			<Badge theme="gray" variant="subtle">
				<template #prefix
					><span :class="[currentType.icon, 'size-3']"
				/></template>
				{{ currentType.label }}
			</Badge>
		</span>
		<span
			class="min-w-0 overflow-hidden sm:min-w-[4.5rem] sm:shrink-0 sm:overflow-visible"
		>
			<Badge theme="gray" variant="subtle">
				{{ marksLabel(row.marks) }}
			</Badge>
		</span>
		<Dropdown
			v-if="!readOnly"
			:options="rowMenu"
			placement="right"
			class="relative z-10"
		>
			<Button
				variant="ghost"
				icon="lucide-more-horizontal"
				:label="__('More actions for question {0}').format(index + 1)"
			/>
		</Dropdown>
	</div>

	<div
		v-else
		:id="`question-card-${row.name}`"
		class="rounded-lg border border-outline-gray-2 bg-surface-base hover:border-outline-gray-3 focus-within:border-outline-gray-4 transition-colors"
	>
		<QuestionEditor
			ref="editorRef"
			v-model:uiType="uiType"
			:question="working"
			:allowedUiTypes="allowedUiTypes"
			:revealErrors="revealErrors"
			:usageCount="usageCount"
			:idPrefix="row.name"
			:answersKey="`${row.name}-${loaded}`"
		>
			<template #actions>
				<Button
					variant="ghost"
					icon="lucide-x"
					:label="__('Close')"
					:disabled="discardBlocked"
					@click="onDone"
				/>
			</template>
		</QuestionEditor>

		<div class="flex items-center justify-between border-t px-4 py-3">
			<div class="flex items-center gap-1">
				<Button
					v-if="!props.draft"
					variant="ghost"
					:disabled="!isValid"
					@click="duplicate"
				>
					<template #prefix><span class="lucide-copy size-4" /></template>
					{{ __('Duplicate') }}
				</Button>
				<Button
					variant="ghost"
					theme="red"
					:disabled="props.draft && discardBlocked"
					@click="onDelete"
				>
					<template #prefix><span class="lucide-trash-2 size-4" /></template>
					{{ __('Delete') }}
				</Button>
			</div>
			<div class="flex items-center gap-3">
				<span v-if="props.draft" class="text-p-sm text-ink-gray-5">
					{{ __('Not saved yet') }}
				</span>
				<Button
					:label="__('Save question')"
					:loading="saving || persistInFlight"
					:disabled="!isValid || saving || persistInFlight"
					@click="handleSave"
				>
					<template #prefix><span class="lucide-check size-4" /></template>
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { Button, Badge, Dropdown, toast } from 'frappe-ui'
import {
	ref,
	computed,
	watch,
	onMounted,
	onBeforeUnmount,
	shallowRef,
	nextTick,
} from 'vue'
import QuestionEditor from './QuestionEditor.vue'
import {
	uiTypeMeta,
	toUiType,
	toBackendType,
	marksLabel,
} from '@/utils/quizQuestion'
import {
	useQuestionDoc,
	getQuestion,
	updateQuestion,
	createQuestion,
} from '@/composables/useQuestionDoc'
import { htmlToText } from '@/utils/inertHtml'

const props = defineProps({
	row: { type: Object, required: true },
	index: { type: Number, required: true },
	quizName: { type: String, required: true },
	editing: { type: Boolean, default: false },
	usageCount: { type: Number, default: 1 },
	// {quizzes, type, multiple} from get_question_meta, or null until it lands.
	meta: { type: Object, default: null },
	readOnly: { type: Boolean, default: false },
	draft: { type: Boolean, default: false },
	reorderDisabled: { type: Boolean, default: false },
	// Which ui types this card may offer. Empty, or the full list, means no restriction.
	allowedUiTypes: { type: Array, default: () => [] },
	// True while the parent writes this draft to the bank. Only it knows when that ends.
	persisting: { type: Boolean, default: false },
})
const emit = defineEmits([
	'edit',
	'done',
	'deleted',
	'duplicated',
	'changed',
	'request-persist',
	'draft-discarded',
	'type-changed',
	'dirty-change',
])

// The parent holds a draft outside the questions array, so `editing` has no say over it.
const isEditing = computed(() => (props.draft ? true : props.editing))

// row.type is there before the question loads, but the child row has no `multiple`
// column, so Choices always reads single until meta or the full question arrives.
const { uiType, working, loaded, isValid, applyDoc, fields } = useQuestionDoc({
	uiType: toUiType(props.meta || props.row),
	marks: props.row.marks ?? 1,
})
watch(
	() => props.meta,
	(meta) => {
		if (meta && !loaded.value) uiType.value = toUiType(meta)
	}
)
const strippedQuestionDetail = computed(() =>
	htmlToText(props.row.question_detail).trim()
)
const editorRef = ref(null)
const saving = ref(false)
const persistRequested = ref(false)
const persistInFlight = computed(
	() => props.persisting || persistRequested.value
)
watch(
	() => props.persisting,
	(on) => {
		if (!on) persistRequested.value = false
	}
)
// `persisting` reaches every card, so only the draft being written may read it.
const discardBlocked = computed(() => props.draft && persistInFlight.value)

const currentType = computed(() => uiTypeMeta(uiType.value))

// A stored question was already invalid on arrival, so it says so at once; a draft waits.
const revealErrors = computed(() => !props.draft)

// Loads the full question on first edit. Marks stay the quiz row's, not the
// bank record's, because this quiz may score the question its own way.
const loadQuestion = () =>
	getQuestion(props.row.question).then((doc) => {
		applyDoc(doc, { marks: props.row.marks ?? 1 })
		rememberStored()
	})

// Both views are v-if branches of one instance, so closing never unmounts and edits survive.
// A wholesale snapshot, not a refetch, so a field added later cannot leak past the rollback.
// shallowRef because the dirty computed reads it and the snapshot is replaced, never mutated.
const stored = shallowRef(null)
const rememberStored = () => {
	stored.value = { fields: { ...working }, uiType: uiType.value }
	editorRef.value?.resetTouched()
}

const revertToStored = () => {
	if (!stored.value) return
	Object.assign(working, stored.value.fields)
	// A stale touched flag would redden restored content the author never touched.
	editorRef.value?.resetTouched()
	// The uiType watcher re-emits type-changed, which drives every other card's lock.
	uiType.value = stored.value.uiType
}

// The parent cannot see `working`, so an open card's edits reach the leave guard through this.
// Measured against the same snapshot revertToStored() uses, so the two cannot disagree.
// Drafts are excluded, and the three guards below overlap but each states a different rule.
const dirty = computed(() => {
	if (props.draft || !loaded.value) return false
	const snap = stored.value
	if (!snap) return false
	// An abandoned type switch is an unsaved edit even with the text untouched.
	if (uiType.value !== snap.uiType) return true
	return Object.keys(working).some((key) => working[key] !== snap.fields[key])
})

// Watching the computed, so a run of keystrokes inside one dirty state emits nothing.
watch(dirty, (on) => emit('dirty-change', on))

// A row deleted while open would otherwise sit in the parent's dirty set forever.
onBeforeUnmount(() => {
	if (dirty.value) emit('dirty-change', false)
})

// Caught here, not in loadQuestion, so `duplicate()` still sees the rejection
// and aborts. Nothing else reports it: no onError on the helpers, no
// fallbackErrorHandler.
watch(
	() => props.editing,
	(on) => {
		if (on && !loaded.value && props.row.question)
			loadQuestion().catch((err) => {
				toast.error(err?.messages?.[0] || __('Could not load the question'))
			})
	},
	{ immediate: true }
)

onMounted(() => {
	if (props.draft) {
		// A draft starts empty. Seeded option text read as real content and could be saved by accident.
		loaded.value = true // enables the answer editor; persistence is gated separately
		nextTick(() => editorRef.value?.focus())
	}
})

// A draft has no server row, so every switch is reported up or hasOpenEnded goes stale.
watch(uiType, (val) => {
	const mapped = toBackendType(val)
	working.type = mapped.type
	working.multiple = mapped.multiple
	emit('type-changed', mapped)
})

// Closing a draft always throws it away. Only the Save button writes it to the bank.
// Discarding is blocked mid-persist, because the parent cannot cancel a request already sent.
const discardDraft = () => {
	if (discardBlocked.value) return false
	emit('draft-discarded')
	return true
}

// Close discards a real row's edits too, and stays enabled as the only way out.
const onDone = () => {
	if (props.draft) {
		discardDraft()
		return
	}
	revertToStored()
	emit('done')
}

// Delete sits outside the mandatory-field gate, because an unfillable row is what you throw away.
const onDelete = () => {
	if (props.draft) {
		discardDraft()
		return
	}
	remove()
}

// Writes the bank record only. Touching LMS Quiz Question would save the whole quiz.
const save = async () => {
	if (!loaded.value) return false
	saving.value = true
	try {
		// marks go with it: they are the question's own field and the dialog writes
		// them, so stripping them left the two authoring paths disagreeing. The
		// quiz's row keeps what it carries.
		await updateQuestion(props.row.question, fields())
		// What was just written is the stored state, so a later Close rolls back to this.
		rememberStored()
		emit('changed', {
			marks: working.marks,
			question_detail: working.question,
			type: working.type,
			multiple: working.multiple,
		})
		return true
	} catch (err) {
		toast.error(err.messages?.[0] || err)
		return false
	} finally {
		saving.value = false
	}
}

// The Save button commits and closes. A draft hands the parent a doc to insert.
const handleSave = async () => {
	if (!isValid.value || saving.value || persistInFlight.value) return
	if (props.draft) {
		// The draft path skips save(), so latch here for the double click, then defer to `persisting`.
		persistRequested.value = true
		emit('request-persist', {
			question_doc: fields(),
			marks: working.marks,
		})
		await nextTick()
		if (!props.persisting) persistRequested.value = false
		return
	}
	if (await save()) emit('done')
}

// The row menu. Clicking the row itself is the way into edit mode.
const rowMenu = computed(() => [
	{ label: __('Duplicate'), icon: 'lucide-copy', onClick: duplicate },
	{ label: __('Delete'), icon: 'lucide-trash-2', onClick: remove },
])

// Forks a fresh LMS Question. The parent inserts the local row, so nothing else is written.
const duplicate = async () => {
	try {
		if (!loaded.value && props.row.question) await loadQuestion()
		const fresh = await createQuestion(fields())
		toast.success(__('Question duplicated'))
		emit('duplicated', {
			question: fresh.name,
			marks: working.marks,
			type: working.type,
			multiple: working.multiple,
			question_detail: working.question,
		})
	} catch (err) {
		toast.error(err.messages?.[0] || err)
	}
}

// Local delete. The bank copy is never touched, because it may be in other quizzes.
const remove = () => {
	emit('deleted')
}
</script>
