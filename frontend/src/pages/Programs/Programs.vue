<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<Button v-if="canCreateProgram()" @click="openForm('new')" variant="solid">
			<template #prefix>
				<Plus class="h-4 w-4 stroke-1.5" />
			</template>
			{{ __('New') }}
		</Button>
	</header>
	<div v-if="programs.data?.length && !isStudent" class="py-10 w-3/4 mx-auto">
		<div class="text-lg font-semibold text-ink-gray-9 mb-5">
			{{
				__('{0} {1}').format(
					programs.data.length,
					programs.data.length == 1 ? __('Program') : __('Programs')
				)
			}}
		</div>
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
			<div
				v-for="program in programs.data"
				@click="openForm(program.name)"
				class="border rounded-md p-3 hover:border-outline-gray-3 cursor-pointer space-y-2"
			>
				<div class="text-lg font-semibold">
					{{ program.name }}
				</div>
				<div class="flex items-center space-x-1">
					<BookOpen class="h-4 w-4 stroke-1.5 mr-1" />
					<span>
						{{ program.course_count }}
						{{ program.course_count == 1 ? __('Course') : __('Courses') }}
					</span>
				</div>
				<div class="flex items-center space-x-1">
					<User class="h-4 w-4 stroke-1.5 mr-1" />
					<span>
						{{ program.member_count || 0 }}
						{{ program.member_count == 1 ? __('member') : __('members') }}
					</span>
				</div>
			</div>
		</div>
	</div>
	<StudentPrograms v-else-if="isStudent" />
	<EmptyState v-else type="Programs" />
	<ProgramForm
		v-model="showForm"
		:programName="currentProgram"
		v-model:programs="programs"
	/>
</template>
<script setup>
import { Breadcrumbs, Button, usePageMeta, createListResource } from 'frappe-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { BookOpen, Plus, User } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import ProgramForm from '@/pages/Programs/ProgramForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import StudentPrograms from '@/pages/Programs/StudentPrograms.vue'

const { brand } = sessionStore()
const user = inject('$user')
const showForm = ref(false)
const currentProgram = ref(null)
const readOnlyMode = window.read_only_mode

onMounted(() => {
	if (!user.data) {
		window.location.href = '/login'
	}
	if (user.data?.is_moderator || user.data?.is_instructor) {
		programs.reload()
	}
})

const programs = createListResource({
	doctype: 'LMS Program',
	cache: ['program'],
	fields: [
		'name',
		'title',
		'member_count',
		'course_count',
		'published',
		'enforce_course_order',
	],
	auto: false,
	orderBy: 'creation desc',
})

const canCreateProgram = () => {
	if (readOnlyMode) return false
	if (user.data?.is_moderator || user.data?.is_instructor) return true
	return false
}

const openForm = (programName) => {
	if (!canCreateProgram()) return
	currentProgram.value = programName
	showForm.value = true
}

const isStudent = computed(() => {
	return user.data?.is_student || false
})

const breadcrumbs = computed(() => [
	{
		label: __('Programs'),
	},
])

usePageMeta(() => {
	return {
		title: __('Programs'),
		icon: brand.favicon,
	}
})
</script>
