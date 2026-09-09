<template>
	<div class="flex h-full flex-col">
		<div class="flex items-center gap-3 p-5 pb-3">
			<FormControl
				class="flex-1"
				type="text"
				v-model="search"
				:placeholder="__('Search')"
				:aria-label="__('Search the question bank')"
			>
				<template #prefix
					><span class="lucide-search size-4 text-ink-gray-5"
				/></template>
			</FormControl>
			<Dropdown align="end" :options="typeFilterMenu">
				<Button variant="outline">
					<template #prefix><span class="lucide-filter size-4" /></template>
					{{ activeTypeLabel }}
					<template #suffix
						><span class="lucide-chevron-down size-4"
					/></template>
				</Button>
			</Dropdown>
			<Button
				class="shrink-0"
				variant="ghost"
				icon="lucide-x"
				:aria-label="__('Close question bank')"
				@click="emit('close')"
			/>
		</div>

		<div class="flex-1 overflow-y-auto px-5">
			<ResponsiveListView
				force-cards
				no-detail-separator
				:columns="columns"
				:rows="displayRows"
				row-key="name"
			>
				<template #cell="{ column, row }">
					<label
						v-if="column.key === 'question'"
						class="flex min-w-0 cursor-pointer items-center gap-2"
					>
						<Checkbox
							class="shrink-0"
							size="md"
							:model-value="isSelected(row)"
							@update:model-value="setSelected(row, $event)"
						/>
						<span class="truncate">{{ htmlToText(row.question).trim() }}</span>
					</label>
					<Badge
						v-else-if="column.key === 'type'"
						theme="gray"
						variant="subtle"
						:class="indentClass(column)"
					>
						<template #prefix
							><span
								:class="[questionTypeMeta(row).icon, 'size-3']"
								aria-hidden="true"
						/></template>
						{{ questionTypeMeta(row).label }}
					</Badge>
					<Badge
						v-else-if="column.key === 'default_marks'"
						theme="gray"
						variant="subtle"
						:class="indentClass(column)"
					>
						{{ marksLabel(row.default_marks) }}
					</Badge>
					<span v-else />
				</template>
			</ResponsiveListView>
			<div
				v-if="!bank.loading && !displayRows.length"
				class="py-10 text-center text-ink-gray-5"
			>
				{{ __('No questions found.') }}
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	FormControl,
	Button,
	Checkbox,
	Dropdown,
	Badge,
	createResource,
} from 'frappe-ui'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { questionTypeMeta, marksLabel } from '@/utils/quizQuestion'
import { htmlToText } from '@/utils/inertHtml'
import { useDebounceFn } from '@vueuse/core'

const props = defineProps({
	quizName: { type: String, required: true },
	// '' | 'Choices' | 'User Input' | 'Open Ended'
	initialType: { type: String, default: '' },
	// Every question in the quiz's local list, staged rows included.
	inQuizQuestionNames: { type: Array, default: () => [] },
	// Backend `type` values that may still be added. Empty means no restriction.
	allowedTypes: { type: Array, default: () => [] },
})
const emit = defineEmits(['added', 'close', 'selection-change'])

const search = ref('')
// Seeded here, not in onMounted, so the one onMounted fetch already carries it.
const typeFilter = ref(props.initialType || '')
const selected = reactive(new Set())

const bank = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.get_question_bank',
	makeParams: () => ({
		quiz: props.quizName,
		search: search.value,
		question_type: typeFilter.value || undefined,
		// Both filters go to the server as well as being applied to displayRows below.
		// One page is all this picker gets, so filtering only here left the bank empty
		// whenever the quiz already held the most recently modified questions.
		exclude: props.inQuizQuestionNames,
		allowed_types: props.allowedTypes,
	}),
	auto: false,
})

const reload = useDebounceFn(() => bank.fetch(), 300)
// The picks are cleared with the rows they were made on. addSelected can only stage
// what the current fetch returned, and no tally survives to say otherwise, so a pick
// carried across a search is one the Add button counts and then silently drops.
watch([search, typeFilter], () => {
	selected.clear()
	reload()
})

// The Add button lives in the quiz form's toolbar, so the count that gates it has
// to leave the panel. `immediate`, or the button starts live over an empty pick.
watch(
	() => selected.size,
	(count) => emit('selection-change', count),
	{ immediate: true }
)

onMounted(() => {
	selected.clear()
	bank.fetch()
})

// Aligned with `align`, which is RTL-correct. Deprecated `placement="end"` moves nothing.
const typeFilterMenu = computed(() => [
	{ label: __('All types'), onClick: () => (typeFilter.value = '') },
	{
		label: __('Single / Multiple choice'),
		onClick: () => (typeFilter.value = 'Choices'),
	},
	{ label: __('User input'), onClick: () => (typeFilter.value = 'User Input') },
	{ label: __('Open ended'), onClick: () => (typeFilter.value = 'Open Ended') },
])
const activeTypeLabel = computed(() => {
	if (typeFilter.value === 'Choices') return __('Choices')
	if (typeFilter.value === 'User Input') return __('User input')
	if (typeFilter.value === 'Open Ended') return __('Open ended')
	return __('All types')
})

// Two whole strings, because a translator has to be able to reach every plural form.
// No status column: a question the quiz already holds is not listed at all.
const columns = computed(() => [
	{ label: __('Question'), key: 'question', width: 3 },
	{ label: __('Type'), key: 'type', width: 1 },
	{ label: __('Marks'), key: 'default_marks', width: 1 },
])

// The title starts 1.5rem in (Checkbox w-4 plus gap-2), so the detail row matches it.
const DETAIL_INDENT = 'ms-6'

// The first non-action column after the title is the one that wears the indent.
const firstDetailKey = computed(
	() => columns.value.slice(1).find((column) => column.kind !== 'actions')?.key
)

const indentClass = (column) =>
	column.key === firstDetailKey.value ? DETAIL_INDENT : ''

// Own selection set, own checkbox. No onRowClick, or the card becomes a button.
const inQuizNames = computed(() => new Set(props.inQuizQuestionNames))

// The prop, never the row's server-side already_in_quiz, which is blind to local edits.
const isInQuiz = (row) => inQuizNames.value.has(row.name)

const isSelected = (row) => selected.has(row.name)

// The bank offers what can still be added, so a question the quiz already holds is
// not listed. Removing one is the card's own Delete, in the list where it sits.
const displayRows = computed(() =>
	(bank.data || []).filter(
		(row) =>
			!isInQuiz(row) &&
			(!props.allowedTypes.length || props.allowedTypes.includes(row.type))
	)
)

// Sets the state asked for, never flips it, because Checkbox reports a click twice.
const setSelected = (row, value) => {
	if (value) selected.add(row.name)
	else selected.delete(row.name)
}

// Writes nothing. The picked rows go up in the order they were shown and the parent stages them.
// question_detail rides along so the new row can draw its preview without another fetch.
const addSelected = () => {
	const picked = displayRows.value.filter((q) => selected.has(q.name))
	if (!picked.length) return

	emit(
		'added',
		picked.map((q) => ({
			question: q.name,
			marks: q.default_marks,
			type: q.type,
			multiple: q.multiple,
			question_detail: q.question,
		}))
	)
	selected.clear()
	emit('close')
}

// Add lives in the quiz form's toolbar, so the parent needs a handle on the action.
defineExpose({ addSelected })
</script>
