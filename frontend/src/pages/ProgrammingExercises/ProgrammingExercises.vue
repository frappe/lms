<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div class="space-x-2">
			<router-link
				:to="{
					name: 'ProgrammingExerciseSubmissions',
				}"
			>
				<Button>
					<template #prefix>
						<ClipboardList class="size-4 stroke-1.5" />
					</template>
					{{ __('Check All Submissions') }}
				</Button>
			</router-link>
			<Button
				v-if="!readOnlyMode"
				variant="solid"
				@click="
					() => {
						exerciseID = 'new'
						showForm = true
					}
				"
			>
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('Create') }}
			</Button>
		</div>
	</header>
	<div class="md:w-4/5 md:mx-auto p-5">
		<div class="flex items-center justify-between mb-5">
			<div v-if="exerciseCount" class="text-lg font-semibold text-ink-gray-9">
				{{ __('{0} Exercises').format(exerciseCount) }}
			</div>
			<div
				v-if="exercises.data?.length || exerciseCount > 0"
				class="grid grid-cols-2 gap-5"
			>
				<!-- <FormControl
                    v-model="titleFilter"
                    :placeholder="__('Search by title')"
                />
                <FormControl
                    v-model="typeFilter"
                    type="select"
                    :options="assignmentTypes"
                    :placeholder="__('Type')"
                /> -->
			</div>
		</div>

		<div
			v-if="exercises.data?.length"
			class="grid grid-cols-1 md:grid-cols-3 gap-4"
		>
			<div
				v-for="exercise in exercises.data"
				:key="exercise.name"
				@click="
					() => {
						exerciseID = exercise.name
						showForm = true
					}
				"
				class="flex flex-col border rounded-md p-3 h-full hover:border-outline-gray-3 space-y-2 cursor-pointer"
			>
				<div class="text-lg font-semibold text-ink-gray-9">
					{{ exercise.title }}
				</div>
				<div class="text-sm text-ink-gray-7">
					{{ exercise.language }}
				</div>
			</div>
		</div>
		<EmptyState v-else type="Programming Exercises" />
		<div
			v-if="exercises.data && exercises.hasNextPage"
			class="flex justify-center my-5"
		>
			<Button @click="exercises.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<ProgrammingExerciseForm
		v-model="showForm"
		:exerciseID="exerciseID"
		v-model:exercises="exercises"
	/>
</template>
<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	usePageMeta,
} from 'frappe-ui'
import { ClipboardList, Plus } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import ProgrammingExerciseForm from '@/pages/ProgrammingExercises/ProgrammingExerciseForm.vue'

const exerciseCount = ref<number>(0)
const readOnlyMode = window.read_only_mode
const { brand } = sessionStore()
const showForm = ref<boolean>(false)
const exerciseID = ref<string | null>('new')
const user = inject<any>('$user')
const router = useRouter()

onMounted(() => {
	validatePermissions()
	getExerciseCount()
})

const validatePermissions = () => {
	if (
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data?.is_evaluator
	) {
		router.push({
			name: 'ProgrammingExerciseSubmissions',
		})
	}
}

const getExerciseCount = () => {
	call('frappe.client.get_count', {
		doctype: 'LMS Programming Exercise',
	})
		.then((count: number) => {
			exerciseCount.value = count
		})
		.catch((error: any) => {
			console.error('Error fetching exercise count:', error)
		})
}

const exercises = createListResource({
	doctype: 'LMS Programming Exercise',
	cache: ['programmingExercises'],
	fields: ['name', 'title', 'language', 'problem_statement'],
	auto: true,
	orderBy: 'modified desc',
})

usePageMeta(() => {
	return {
		title: __('Programming Exercises'),
		icon: brand.favicon,
	}
})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Programming Exercises'),
			route: { name: 'ProgrammingExercises' },
		},
	]
})
</script>
