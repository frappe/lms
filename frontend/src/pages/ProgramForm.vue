<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadbrumbs" />
		<Button variant="solid" @click="saveProgram()">
			{{ __('Save') }}
		</Button>
	</header>
	<div v-if="program.doc" class="pt-5 px-5 w-3/4 mx-auto space-y-10">
		<FormControl v-model="program.doc.title" :label="__('Title')" />

		<!-- Courses -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<div class="text-lg text-ink-gray-9 font-semibold">
					{{ __('Program Courses') }}
				</div>
				<Button
					@click="
						() => {
							currentForm = 'course'
							showDialog = true
						}
					"
				>
					<template #prefix>
						<Plus class="w-4 h-4" />
					</template>
					{{ __('Add') }}
				</Button>
			</div>

			<ListView
				:columns="courseColumns"
				:rows="program.doc.program_courses"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in courseColumns" />
				</ListHeader>
				<ListRows>
					<Draggable
						:list="program.doc.program_courses"
						item-key="name"
						group="items"
						@end="updateOrder"
						class="cursor-move"
					>
						<template #item="{ element: row }">
							<ListRow :row="row" />
						</template>
					</Draggable>
				</ListRows>
				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="remove(selections, unselectAll, 'program_courses')"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>

		<!-- Members -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<div class="text-lg text-ink-gray-9 font-semibold">
					{{ __('Program Members') }}
				</div>
				<Button
					@click="
						() => {
							currentForm = 'member'
							showDialog = true
						}
					"
				>
					<template #prefix>
						<Plus class="w-4 h-4" />
					</template>
					{{ __('Add') }}
				</Button>
			</div>

			<ListView
				:columns="memberColumns"
				:rows="program.doc.program_members"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in memberColumns" />
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in program.doc.program_members" />
				</ListRows>
				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="remove(selections, unselectAll, 'program_members')"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
	</div>

	<Dialog
		v-model="showDialog"
		:options="{
			title:
				currentForm == 'course'
					? __('New Program Course')
					: __('New Program Member'),
			actions: [
				{
					label: __('Add'),
					variant: 'solid',
					onClick: () =>
						currentForm == 'course'
							? addProgramCourse(close)
							: addProgramMember(close),
				},
			],
		}"
	>
		<template #body-content>
			<Link
				v-if="currentForm == 'course'"
				v-model="course"
				doctype="LMS Course"
				:filters="{
					disable_self_learning: 1,
				}"
				:label="__('Program Course')"
				:description="
					__(
						'Only courses for which self learning is disabled can be added to program.'
					)
				"
			/>

			<Link
				v-if="currentForm == 'member'"
				v-model="member"
				doctype="User"
				:filters="{
					ignore_user_type: 1,
				}"
				:label="__('Program Member')"
				:onCreate="(value, close) => openSettings('Members', close)"
			/>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createDocumentResource,
	Dialog,
	FormControl,
	ListView,
	ListRows,
	ListRow,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import { openSettings } from '@/utils'
import Draggable from 'vuedraggable'
import Link from '@/components/Controls/Link.vue'

const { brand } = sessionStore()
const showDialog = ref(false)
const currentForm = ref(null)
const course = ref(null)
const member = ref(null)
const router = useRouter()

const props = defineProps({
	programName: {
		type: String,
		required: true,
	},
})

const program = createDocumentResource({
	doctype: 'LMS Program',
	name: props.programName,
	auto: true,
	cache: ['program', props.programName],
})

const addProgramCourse = () => {
	program.setValue.submit(
		{
			program_courses: [
				...program.doc.program_courses,
				{ course: course.value },
			],
		},
		{
			onSuccess(data) {
				showDialog.value = false
				course.value = null
				toast.success(__('Course added to program'))
				program.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const addProgramMember = () => {
	program.setValue.submit(
		{
			program_members: [
				...program.doc.program_members,
				{ member: member.value },
			],
		},
		{
			onSuccess(data) {
				showDialog.value = false
				member.value = null
				toast.success(__('Member added to program'))
				program.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const remove = (selections, unselectAll, doctype) => {
	selections = Array.from(selections)
	program.setValue.submit(
		{
			[doctype]: program.doc[doctype].filter(
				(row) => !selections.includes(row.name)
			),
		},
		{
			onSuccess(data) {
				unselectAll()
				toast.success(__('Items removed successfully'))
				program.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const updateOrder = (e) => {
	let sourceIdx = e.from.dataset.idx
	let targetIdx = e.to.dataset.idx
	let courses = program.doc.program_courses
	courses.splice(targetIdx, 0, courses.splice(sourceIdx, 1)[0])

	courses.forEach((course, index) => {
		course.idx = index + 1
	})

	program.setValue.submit(
		{
			program_courses: courses,
		},
		{
			onSuccess(data) {
				toast.success(__('Course moved successfully'))
				program.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const saveProgram = () => {
	call('frappe.model.rename_doc.update_document_title', {
		doctype: 'LMS Program',
		docname: program.doc.name,
		name: program.doc.title,
	}).then((data) => {
		router.push({ name: 'ProgramForm', params: { programName: data } })
	})
}

const courseColumns = computed(() => {
	return [
		{
			label: 'Title',
			key: 'course_title',
			width: 3,
		},
		{
			label: 'ID',
			key: 'course',
			width: 3,
		},
	]
})

const memberColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member',
			width: 3,
			align: 'left',
		},
		{
			label: 'Full Name',
			key: 'full_name',
			width: 3,
			align: 'left',
		},
		{
			label: 'Progress (%)',
			key: 'progress',
			width: 3,
			align: 'right',
		},
	]
})

const breadbrumbs = computed(() => {
	return [
		{
			label: 'Programs',
			route: { name: 'Programs' },
		},
		{
			label: props.programName === 'new' ? 'New Program' : props.programName,
		},
	]
})

usePageMeta(() => {
	return {
		title: program.doc?.title,
		icon: brand.favicon,
	}
})
</script>
