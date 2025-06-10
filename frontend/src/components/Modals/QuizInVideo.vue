<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add quiz to this video'),
			size: '2xl',
		}"
	>
		<template #body-content>
			<div class="text-base">
				<div class="flex items-end gap-4">
					<FormControl
						:label="__('Time in Video')"
						v-model="quiz.time"
						type="text"
						placeholder="2:15"
						class="flex-1"
					/>
					<Link
						v-model="quiz.quiz"
						:label="__('Quiz')"
						doctype="LMS Quiz"
						class="flex-1"
					/>
					<Button @click="addQuiz()" variant="solid">
						<template #prefix>
							<Plus class="w-4 h-4 stroke-1.5" />
						</template>
						{{ __('Add') }}
					</Button>
				</div>

				<div class="mt-10 mb-5">
					<div class="font-medium mb-4">
						{{ __('Quizzes in this video') }}
					</div>
					<ListView
						v-if="allQuizzes.length"
						:columns="columns"
						:rows="allQuizzes"
						row-key="quiz"
						:options="{
							showTooltip: false,
						}"
					>
						<ListHeader
							class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
						>
							<ListHeaderItem :item="item" v-for="item in columns">
								<template #prefix="{ item }">
									<component
										v-if="item.icon"
										:is="item.icon"
										class="h-4 w-4 stroke-1.5 ml-4"
									/>
								</template>
							</ListHeaderItem>
						</ListHeader>

						<ListRows>
							<ListRow :row="row" v-for="row in allQuizzes">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key as keyof Quiz]"
										:align="column.align"
									>
										<div v-if="column.key == 'time'" class="leading-5 text-sm">
											{{ formatTimestamp(row[column.key as keyof Quiz]) }}
										</div>
										<div v-else class="leading-5 text-sm">
											{{ row[column.key as keyof Quiz] }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>

						<ListSelectBanner>
							<template #actions="{ unselectAll, selections }">
								<div class="flex gap-2">
									<Button
										variant="ghost"
										@click="removeQuiz(selections, unselectAll)"
									>
										<Trash2 class="h-4 w-4 stroke-1.5" />
									</Button>
								</div>
							</template>
						</ListSelectBanner>
					</ListView>

					<div v-else class="text-ink-gray-5 italic text-xs">
						{{ __('No quizzes added yet.') }}
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Dialog,
	Button,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	toast,
} from 'frappe-ui'
import { computed, reactive, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { formatTimestamp } from '@/utils'
import Link from '@/components/Controls/Link.vue'

type Quiz = {
	time: string
	quiz: string
}

const show = defineModel()
const allQuizzes = ref<Quiz[]>([])
const quiz = reactive<Quiz>({
	time: '',
	quiz: '',
})

const props = defineProps({
	quizzes: {
		type: Array as () => Quiz[],
		default: () => [],
	},
	saveQuizzes: {
		type: Function,
		required: true,
	},
	duration: {
		type: Number,
		default: 0,
	},
})

const addQuiz = () => {
	quiz.time = `${getTimeInSeconds()}`
	if (!isTimeValid() || !isFormComplete()) return

	allQuizzes.value.push({
		time: quiz.time,
		quiz: quiz.quiz,
	})

	props.saveQuizzes(allQuizzes.value)

	quiz.time = ''
	quiz.quiz = ''
}

const getTimeInSeconds = () => {
	if (quiz.time && !quiz.time.includes(':')) {
		quiz.time = `${quiz.time}:00`
	}
	const timeParts = quiz.time.split(':')
	const timeInSeconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])

	return timeInSeconds
}

const isTimeValid = () => {
	if (parseInt(quiz.time) > props.duration) {
		toast.error(__('Time in video exceeds the total duration of the video.'))
		return false
	}
	return true
}

const isFormComplete = () => {
	if (!quiz.time) {
		toast.error(__('Please enter a valid timestamp'))
		return false
	}

	if (!quiz.quiz) {
		toast.error(__('Please select a quiz'))
		return false
	}

	return true
}

const removeQuiz = (selections: string, unselectAll: () => void) => {
	Array.from(selections).forEach((selection) => {
		const index = allQuizzes.value.findIndex((q) => q.quiz === selection)
		if (index !== -1) {
			allQuizzes.value.splice(index, 1)
		}
		unselectAll()
	})
	props.saveQuizzes(allQuizzes.value)
}

watch(
	() => props.quizzes,
	(newQuizzes) => {
		allQuizzes.value = newQuizzes
	},
	{ immediate: true }
)

const columns = computed(() => {
	return [
		{
			key: 'quiz',
			label: __('Quiz'),
		},
		{
			key: 'time',
			label: __('Time in Video (minutes)'),
			align: 'center',
		},
	]
})
</script>
