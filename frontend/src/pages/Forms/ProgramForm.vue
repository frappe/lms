<template>
	<FormShell
		:title="isNew ? __('Create Program') : __('Edit Program')"
		size="2xl"
		@close="close"
	>
		<template #header-action>
			<Badge theme="orange" v-if="dirty">
				{{ __('Not Saved') }}
			</Badge>
		</template>
		<template #default>
			<div v-if="!canManageProgram" class="p-4 text-base text-ink-gray-6">
				{{ __('You are not permitted to manage programs.') }}
			</div>
			<div v-else data-testid="program-fields" class="text-base">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-5 pb-5">
					<FormControl
						v-model="program.name"
						:label="__('Title')"
						type="text"
						:required="true"
						@change="dirty = true"
					/>
					<div class="flex flex-col space-y-3">
						<FormControl
							v-model="program.published"
							:label="__('Published')"
							type="checkbox"
							@change="dirty = true"
						/>
						<FormControl
							v-model="program.enforce_course_order"
							:label="__('Enforce Course Order')"
							type="checkbox"
							@change="dirty = true"
						/>
					</div>
				</div>

				<div class="pb-5">
					<div class="flex items-center justify-between mt-5 mb-4">
						<div class="text-lg-semibold text-ink-gray-9">
							{{ __('Courses') }}
						</div>
						<Button @click="openChildForm('course')">
							<template #prefix>
								<span class="lucide-plus size-4" />
							</template>
							<span>
								{{ __('Add') }}
							</span>
						</Button>
					</div>
					<ListView
						v-if="program.program_courses?.length > 0"
						:columns="courseColumns"
						:rows="program.program_courses"
						:options="{
							selectable: true,
							resizeColumn: true,
							showTooltip: false,
						}"
						:rowKey="'course'"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in courseColumns"
								:key="item.key"
							/>
						</ListHeader>
						<ListRows>
							<Draggable
								:list="program.program_courses"
								:item-key="'course'"
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
										:label="__('Delete')"
										@click="remove(selections, unselectAll, 'courses')"
									>
										<template #icon>
											<span class="lucide-trash-2 size-4" />
										</template>
									</Button>
								</div>
							</template>
						</ListSelectBanner>
					</ListView>
					<div v-else class="text-ink-gray-7">
						{{ __('No courses added yet.') }}
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mt-5 mb-4">
						<div class="text-lg-semibold text-ink-gray-9">
							{{ __('Members') }}
						</div>

						<div class="flex gap-x-2">
							<Button
								v-if="(programMembers.data?.length ?? 0) > 0"
								@click="
									() => {
										showProgressDialog = true
									}
								"
							>
								<template #prefix>
									<span class="lucide-trending-up size-4" />
								</template>
								{{ __('Progress Summary') }}
							</Button>
							<Button @click="openChildForm('member')">
								<template #prefix>
									<span class="lucide-plus size-4" />
								</template>
								{{ __('Add') }}
							</Button>
						</div>
					</div>
					<ResponsiveListView
						v-if="program.program_members?.length > 0"
						:columns="memberColumns"
						:rows="program.program_members"
						row-key="member"
						:options="{ selectable: true }"
					>
						<template #selection-actions="{ unselectAll, selections }">
							<Button
								variant="ghost"
								:label="__('Delete')"
								@click="remove(selections, unselectAll, 'members')"
							>
								<template #icon>
									<span class="lucide-trash-2 size-4" />
								</template>
							</Button>
						</template>
					</ResponsiveListView>
					<div v-else class="text-ink-gray-7">
						{{ __('No members added yet.') }}
					</div>
				</div>
			</div>
			<Dialog
				v-model:open="showFormDialog"
				:title="
					currentForm == 'course'
						? __('Add Course to Program')
						: __('Enroll Member to Program')
				"
				:actions="[
					{
						label: __('Add'),
						variant: 'solid',
						onClick: ({ close }: { close: () => void }) =>
							currentForm == 'course' ? addCourse(close) : addMember(close),
					},
				]"
			>
				<template #default>
					<div @click.stop>
						<Link
							v-if="currentForm == 'course'"
							v-model="course"
							doctype="LMS Course"
							:label="__('Course')"
						/>

						<Link
							v-if="currentForm == 'member'"
							v-model="member"
							doctype="User"
							:filters="{
								ignore_user_type: 1,
							}"
							:label="__('Program Member')"
							:onCreate="
								(value: string, close: () => void) =>
									openSettings('Members', close)
							"
						/>
					</div>
				</template>
			</Dialog>

			<ProgramProgressSummary
				v-model="showProgressDialog"
				:programName="programId"
				:programMembers="programMembers.data || []"
			/>
		</template>
		<template #actions>
			<div v-if="canManageProgram" class="flex items-center justify-end gap-2">
				<HeaderButton
					v-if="!isNew"
					data-testid="program-delete"
					:label="__('Delete program')"
					icon="lucide-trash-2"
					variant="outline"
					theme="red"
					@click="deleteProgram()"
				/>
				<HeaderButton
					data-testid="program-save"
					:label="__('Save')"
					variant="solid"
					@click="saveProgram()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import {
	Badge,
	Button,
	createDocumentResource,
	createListResource,
	Dialog,
	FormControl,
	ListSelectBanner,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	toast,
} from 'frappe-ui'
import { computed, inject, ref, watch, getCurrentInstance } from 'vue'

import { Program, ProgramCourse, ProgramMember } from '@/types'
import { openSettings } from '@/utils'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import Link from '@/components/Controls/Link.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import Draggable from 'vuedraggable'
import ProgramProgressSummary from '@/components/Programs/ProgramProgressSummary.vue'
import { submitResource } from '@/utils/resource'

const showFormDialog = ref(false)
const currentForm = ref<'course' | 'member'>('course')
const course = ref<string>('')
const member = ref<string>('')
const showProgressDialog = ref(false)
const dirty = ref(false)
const user = inject<any>('$user')

const app = getCurrentInstance()
const { $dialog } = app!.appContext.config.globalProperties

const props = withDefaults(
	defineProps<{
		programName?: string | null
	}>(),
	{
		programName: 'new',
	}
)

// The parent list refetches through its own updatePrograms(), which drives the
// `reloading` flag and the footer count as well (Programs.vue:175-187). A bare
// resource reload from here would skip both and bring back the flash of empty
// state, so signal the parent instead of reaching into its resource.
const emit = defineEmits<{ saved: [] }>()

const { close, saveAndReplace } = useFormRoute({ name: 'Programs' })

// R3: `withDefaults` only fills an *undefined* prop, so the `null` this form
// used to be handed by the parent (Programs.vue's `currentProgram` ref) slipped
// straight through and every `=== 'new'` comparison below took the EDIT branch
// before a program had been chosen. The route param is always a string now, but
// the sentinel is still normalised in exactly one place rather than eight.
const programId = computed(() => props.programName || 'new')
const isNew = computed(() => programId.value === 'new')

// Copied from Programs.vue:268-275, which gates both the Create button and the
// card that opens an existing program. A URL goes through neither. This is a UX
// gate, not an authorization boundary — the server's DocPerms on LMS Program
// are; this only spares an unentitled user a form that could never save.
const canManageProgram = computed(() => {
	// Cast because Window has no read_only_mode declaration; same shape as
	// NewBatchForm.vue:190.
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return false
	return Boolean(user.data?.is_moderator || user.data?.is_instructor)
})

const program = ref<Program>({
	name: '',
	title: '',
	published: false,
	enforce_course_order: false,
	program_courses: [],
	program_members: [],
})

// This form owns its LMS Program resource instead of the parent's list resource
// (`cache: ['program']`). Deliberately a DIFFERENT cache key: reusing the
// parent's would hand back its cached instance and make insert.onSuccess refetch
// it behind the page's back, which is exactly the bare reload the `saved` emit
// exists to avoid. Edits still reach the list for free — setValue.onSuccess
// calls updateRowInListResource, which patches the row in every registered list
// resource for the doctype (listResource.js:144).
const programs = createListResource({
	doctype: 'LMS Program',
	cache: ['programForm'],
	auto: false,
})

// C4: edit mode used to be seeded from the parent's in-memory array. On a cold
// deep link that array is empty, so the form rendered as if the program had no
// title and no child rows — and a Save from that state posted the emptiness
// back over the real record. Fetch our own document instead, exactly as
// JobForm.vue:182-190 does. createDocumentResource returns undefined when
// `name` is falsy (documentResource.js:15), hence the optional chaining.
const programDoc = createDocumentResource({
	doctype: 'LMS Program',
	name: isNew.value ? undefined : programId.value,
	auto: !isNew.value,
	onError(err: any) {
		toast.warning(__(err.messages?.[0] || err))
	},
})

const programCourses = createListResource({
	doctype: 'LMS Program Course',
	fields: ['course', 'course_title', 'name', 'idx'],
	parent: 'LMS Program',
	orderBy: 'idx',
	onSuccess(data: ProgramCourse[]) {
		program.value.program_courses = data
	},
})

const programMembers = createListResource({
	doctype: 'LMS Program Member',
	fields: ['member', 'full_name', 'progress', 'name'],
	parent: 'LMS Program',
	orderBy: 'creation desc',
	onSuccess(data: ProgramMember[]) {
		program.value.program_members = data
	},
})

const fetchCourses = () => {
	programCourses.update({
		filters: {
			parent: programId.value,
			parenttype: 'LMS Program',
			parentfield: 'program_courses',
		},
	})
	programCourses.reload()
}

const fetchMembers = () => {
	programMembers.update({
		filters: {
			parent: programId.value,
			parenttype: 'LMS Program',
			parentfield: 'program_members',
		},
	})
	programMembers.reload()
}

// Only the scalar fields. The two child tables belong to the list resources
// above, whose responses can land either side of this one — copying them out of
// the document would let whichever arrived first win.
const applyDoc = (doc: Program) => {
	program.value.name = doc.name
	program.value.title = doc.title
	program.value.published = Boolean(doc.published)
	program.value.enforce_course_order = Boolean(doc.enforce_course_order)
	dirty.value = false
}

// C3: this watch had no `immediate: true`, so nothing loaded on mount. That was
// invisible while the parent modal was always mounted first and only the prop
// changed; a directly-mounted route renders blank without it.
watch(
	programId,
	() => {
		if (isNew.value) return
		fetchCourses()
		fetchMembers()
	},
	{ immediate: true }
)

watch(
	() => programDoc?.doc,
	(doc) => {
		if (doc) applyDoc(doc)
	},
	{ immediate: true }
)

const validateTitle = () => {
	program.value.name = sanitizeOnWrite(program.value.name.trim())
}

const saveProgram = () => {
	if (!canManageProgram.value) return
	validateTitle()
	if (isNew.value) createNewProgram()
	else updateProgram()
	dirty.value = false
}

// Saving navigates onward by REPLACING, so the entry this form was opened on is
// consumed and Back reaches the list rather than a stale form.
const afterSave = () => {
	emit('saved')
	saveAndReplace({ name: 'Programs' })
}

const createNewProgram = () => {
	submitResource(
		programs.insert,
		{
			...program.value,
			title: program.value.name,
		},
		{
			onSuccess() {
				toast.success(__('Program created successfully'))
				afterSave()
			},
			onError(err: any) {
				toast.warning(__(err.messages?.[0] || err))
			},
		}
	)
}

const updateProgram = () => {
	submitResource(
		programs.setValue,
		{
			// Spread first: LMS Program is `autoname: field:title`, so
			// `program.value.name` is the docname AND what the Title input edits.
			// Spreading it last overwrote the row being addressed with the new
			// title, so set_value targeted a docname that does not exist yet and
			// no program could ever be renamed.
			...program.value,
			name: programId.value,
		},
		{
			onSuccess() {
				toast.success(__('Program updated successfully'))
				afterSave()
			},
			onError(err: any) {
				toast.warning(__(err.messages?.[0] || err))
			},
		}
	)
}

const openChildForm = (formType: 'course' | 'member') => {
	currentForm.value = formType
	showFormDialog.value = true
	if (formType === 'course') {
		course.value = ''
	} else {
		member.value = ''
	}
}

const addCourse = (close: () => void) => {
	if (!course.value) {
		toast.warning(__('Please select a course'))
		return
	}

	const existingCourse = program.value.program_courses.find(
		(c: any) => c.course === course.value
	)
	if (!existingCourse) {
		program.value.program_courses.push({
			course: course.value,
			idx: program.value.program_courses.length + 1,
		} as ProgramCourse)
		if (!isNew.value) {
			dirty.value = true
		}
		close()
		toast.success(__('Course added to program successfully'))
	} else {
		toast.warning(__('Course already added to program'))
	}
}

const addMember = (close: () => void) => {
	if (!member.value) {
		toast.warning(__('Please select a member'))
		return
	}

	const existingMember = program.value.program_members.find(
		(m: ProgramMember) => m.member === member.value
	)
	if (!existingMember) {
		program.value.program_members.push({
			member: member.value,
		} as ProgramMember)
		if (!isNew.value) {
			dirty.value = true
		}
		close()
		toast.success(__('Member added to program successfully'))
	} else {
		toast.warning(__('Member already added to program'))
	}
}

const updateOrder = async (e: any) => {
	let sourceIdx = e.from.dataset.idx
	let targetIdx = e.to.dataset.idx

	if (isNew.value) {
		let courses = program.value.program_courses
		courses.splice(targetIdx, 0, courses.splice(sourceIdx, 1)[0])
		courses.forEach((course, index) => {
			course.idx = index + 1
		})
		dirty.value = true
	} else {
		let courses = programCourses.data
		courses.splice(targetIdx, 0, courses.splice(sourceIdx, 1)[0])

		for (const [index, course] of courses.entries()) {
			submitResource(
				programCourses.setValue,
				{
					name: course.name,
					idx: index + 1,
				},
				{
					onError(err: any) {
						toast.warning(__(err.messages?.[0] || err))
					},
				}
			)
			await wait(100)
		}
	}
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

const remove = (
	selections: string[],
	unselectAll: () => void,
	type: string
) => {
	const selectionsArray = Array.from(selections)
	if (type === 'courses') {
		program.value.program_courses = program.value.program_courses.filter(
			(c: any) => !selectionsArray.includes(c.name || c.course)
		)
	} else {
		program.value.program_members = program.value.program_members.filter(
			(m: any) => !selectionsArray.includes(m.name || m.member)
		)
	}
	dirty.value = true
	unselectAll()
}

const deleteProgram = () => {
	if (isNew.value) return
	$dialog({
		title: __('Delete Program'),
		message: __(
			'Are you sure you want to delete this program? This action cannot be undone.'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(closeDialog: () => void) {
					submitResource(programs.delete, programId.value, {
						onSuccess() {
							toast.success(__('Program deleted successfully'))
							emit('saved')
							closeDialog()
							close()
						},
						onError(err: any) {
							toast.warning(__(err.messages?.[0] || err))
							closeDialog()
						},
					})
				},
			},
		],
	})
}

const courseColumns = computed(() => {
	return [
		{
			label: 'Title',
			key: isNew.value ? 'course' : 'course_title',
			width: 1,
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
	]
})
</script>
