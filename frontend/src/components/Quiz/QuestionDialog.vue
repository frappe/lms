<template>
	<FormShell
		v-if="show"
		size="4xl"
		:title="questionName ? __('Edit question') : __('New question')"
		@close="show = false"
	>
		<template #default>
			<div
				v-if="loading"
				class="flex items-center justify-center"
				:class="bodyHeight"
				data-testid="question-dialog-loading"
			>
				<LoadingIndicator class="size-5 text-ink-gray-5" />
			</div>
			<div
				v-else
				class="overflow-y-auto"
				:class="bodyHeight"
				data-testid="question-body"
			>
				<div :class="FILL_WRAPPER">
					<QuestionEditor
						v-model:uiType="uiType"
						:question="working"
						:revealErrors="revealErrors"
						:padded="false"
						:fillHeight="true"
						:idPrefix="idPrefix"
						:answersKey="`${idPrefix}-${loaded}`"
					/>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex items-center justify-end">
				<HeaderButton
					data-testid="question-save"
					:label="__('Save')"
					variant="solid"
					:loading="saving"
					:disabled="!isValid || saving || loading"
					@click="save"
				/>
			</div>
		</template>
	</FormShell>
</template>

<script setup>
import { LoadingIndicator, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import QuestionEditor from '@/components/Quiz/QuestionEditor.vue'
import { useScreenSize } from '@/utils/composables'
import {
	useQuestionDoc,
	updateQuestion,
	createQuestion,
} from '@/composables/useQuestionDoc'
import { resourceErrorMessage } from '@/utils/resource'

const props = defineProps({
	// The LMS Question to edit. Empty opens the dialog on a new one.
	questionName: { type: String, default: '' },
})
const show = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['saved'])

const { uiType, working, loaded, isValid, load, reset, fieldsWithType } =
	useQuestionDoc()
const loading = ref(false)
const saving = ref(false)
const idPrefix = computed(() => props.questionName || 'new')

const { isMobile } = useScreenSize()
// Fixed, not content-sized. Switching type swaps one text field for ten option
// rows, and a box that resized under that would move Save as the author reached
// for it. Capped in rem as well as vh so a tall monitor does not stretch it.
const bodyHeight = computed(() =>
	isMobile.value ? 'h-full' : 'h-[min(60vh,32rem)]'
)

// min-h-full, not h-full. The editor needs a definite height to stretch into
// when a question is short, and room to grow past it when ten options do not
// fit. That is what makes the box above scroll instead of overlap.
const FILL_WRAPPER = 'flex min-h-full flex-col'

// A stored question can arrive invalid through nobody's fault, so it says so at once.
const revealErrors = computed(() => Boolean(props.questionName) && loaded.value)

const loadQuestion = async () => {
	loading.value = true
	try {
		await load(props.questionName)
	} catch (error) {
		toast.error(resourceErrorMessage(error, __('Error loading question')))
		show.value = false
	}
	loading.value = false
}

// Every open starts from the record, never from what the last one was left on.
watch(show, (open) => {
	if (!open) return
	reset()
	if (props.questionName) loadQuestion()
	else loaded.value = true
})

const save = async () => {
	if (!isValid.value || saving.value) return
	saving.value = true
	try {
		if (props.questionName) {
			await updateQuestion(props.questionName, fieldsWithType())
		} else {
			await createQuestion(fieldsWithType())
		}
		toast.success(
			props.questionName
				? __('Question updated successfully')
				: __('Question created successfully')
		)
		emit('saved')
		show.value = false
	} catch (error) {
		toast.error(resourceErrorMessage(error, __('Error saving question')))
	}
	saving.value = false
}
</script>
