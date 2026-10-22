<template>
	<div class="flex h-full min-h-0 flex-col gap-3">
		<MultiSelect
			:id="pickerId"
			ref="selectRef"
			v-model="pickerModel"
			v-model:query="query"
			:options="options"
			:loading="loading"
			:filterable="false"
			variant="outline"
			class="w-full"
			:label="__('Students')"
			:placeholder="__('Search by name or email, or paste emails')"
			:emptyText="__('No users found')"
			:error="capMessage"
			@update:open="(isOpen) => onOpen(isOpen as boolean)"
		>
			<template #prefix>
				<div
					v-if="visibleSelected.length"
					class="flex -space-x-1.5 rtl:space-x-reverse"
				>
					<Avatar
						v-for="student in visibleSelected"
						:key="student.value"
						:image="student.image ?? undefined"
						:label="student.label"
						size="sm"
					/>
					<span
						v-if="overflowCount > 0"
						class="z-10 grid size-5 place-items-center rounded-full bg-surface-gray-3 text-p-xs-medium text-ink-gray-7"
					>
						+{{ overflowCount }}
					</span>
				</div>
				<span
					v-else
					class="lucide-users size-4 text-ink-gray-6"
					aria-hidden="true"
				/>
			</template>
			<template #item-prefix="{ item }">
				<Avatar
					:image="(item as StudentOption).image ?? undefined"
					:label="item.label"
					size="sm"
				/>
			</template>
			<template #item-label="{ item }">
				<div class="flex min-w-0 justify-between gap-2">
					<div class="truncate">{{ item.label }}</div>
					<div class="truncate text-p-sm text-ink-gray-6">
						{{ (item as StudentOption).description }}
					</div>
				</div>
			</template>
		</MultiSelect>
		<slot name="beforeList" />
		<ul
			v-if="members.length"
			ref="selectedList"
			class="flex min-h-0 flex-1 flex-col overflow-y-auto"
			:aria-label="__('Selected students')"
		>
			<li
				v-for="student in selectedStudents"
				:key="student.value"
				data-testid="selected-student"
				class="flex items-center gap-2 border-b border-outline-gray-1 py-1.5 last:border-b-0"
			>
				<Avatar
					size="md"
					:image="student.image ?? undefined"
					:label="student.label"
				/>
				<div class="min-w-0 flex-1">
					<div
						data-testid="student-name"
						class="truncate text-base text-ink-gray-8"
					>
						{{ student.label }}
					</div>
					<div class="truncate text-sm text-ink-gray-6">
						{{ student.value }}
					</div>
				</div>
				<Button
					variant="ghost"
					icon="lucide-x"
					:aria-label="__('Remove {0}', [student.label])"
					@click="remove(student.value)"
				/>
			</li>
		</ul>
		<EmptyStateLayout
			v-else
			data-testid="selected-empty"
			class="flex-1"
			:name="__('Students')"
			:title="__('No students added')"
			:description="__('Students you add will be listed here.')"
			icon="lucide-users"
		/>
	</div>
</template>
<script setup lang="ts">
import { Avatar, Button, MultiSelect, createResource } from 'frappe-ui'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import {
	MAX_STUDENTS,
	mergeMembers,
	parseEmailList,
} from '@/components/Enrollment/enrollment'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import type { EnrollTargetDoctype, Resource, StudentOption } from '@/types'

const props = defineProps<{
	enrollDoctype: EnrollTargetDoctype
	enrollDocname: string
	includeEnrolled: boolean
}>()

const members = defineModel<string[]>({ default: () => [] })

const PAGE_LENGTH = 20
const MAX_AVATARS = 3

const query = ref<string>('')
const capMessage = ref<string>('')
const loading = ref<boolean>(false)
const results = ref<StudentOption[]>([])
const known = reactive(new Map<string, StudentOption>())
const selectRef = ref<{ focus: () => void } | null>(null)
const selectedList = ref<HTMLElement | null>(null)
const pickerId = useId()

const search = createResource({
	url: 'lms.lms.api.search_users_to_enroll',
	method: 'POST',
}) as unknown as Resource<StudentOption[]>

const lookup = createResource({
	url: 'lms.lms.api.search_users_to_enroll',
	method: 'POST',
}) as unknown as Resource<StudentOption[]>

const targetParams = () => ({
	enroll_doctype: props.enrollDoctype,
	enroll_docname: props.enrollDocname,
	include_enrolled: props.includeEnrolled,
})

const keyOf = (member: string): string => member.toLowerCase()

const remember = (rows: readonly StudentOption[]) => {
	for (const row of rows) known.set(keyOf(row.value), row)
}

let requestId = 0
let loaded = false

const fetchStudents = async (txt: string) => {
	const id = ++requestId
	loaded = true
	loading.value = true
	try {
		const rows = await search.submit({
			txt,
			...targetParams(),
			page_length: PAGE_LENGTH,
		})
		if (id !== requestId) return
		results.value = rows ?? []
		remember(results.value)
	} catch {
		if (id === requestId) results.value = []
	} finally {
		if (id === requestId) loading.value = false
	}
}

const eligibleAmong = async (
	emails: readonly string[]
): Promise<string[] | null> => {
	const unknown = emails.filter((email) => !known.has(keyOf(email)))
	if (unknown.length) {
		try {
			const rows = await lookup.submit({
				...targetParams(),
				names: JSON.stringify(unknown),
				page_length: unknown.length,
			})
			remember(rows ?? [])
		} catch {
			return null
		}
	}
	return emails.flatMap((email) => known.get(keyOf(email))?.value ?? [])
}

const runSearch = useDebounceFn(fetchStudents, 250)

const onOpen = (isOpen: boolean) => {
	if (!isOpen) return
	query.value = ''
	if (!loaded) fetchStudents('')
}

watch(
	() => props.includeEnrolled,
	async () => {
		loaded = false
		results.value = []
		known.clear()
		const found = await eligibleAmong(members.value)
		if (!found) return
		const eligible = new Set(found)
		const kept = members.value.filter((member) => eligible.has(member))
		if (kept.length !== members.value.length) members.value = kept
	}
)

const optionFor = (member: string): StudentOption =>
	known.get(keyOf(member)) ?? {
		value: member,
		label: member,
		description: member,
		image: null,
	}

const options = computed<StudentOption[]>(() => {
	const byValue = new Map<string, StudentOption>()
	for (const row of results.value) byValue.set(keyOf(row.value), row)
	for (const member of members.value) {
		if (!byValue.has(keyOf(member))) {
			byValue.set(keyOf(member), optionFor(member))
		}
	}
	return Array.from(byValue.values())
})

const selectedStudents = computed<StudentOption[]>(() =>
	members.value.map(optionFor)
)

const visibleSelected = computed<StudentOption[]>(() =>
	selectedStudents.value.slice(0, MAX_AVATARS)
)

const overflowCount = computed<number>(() =>
	Math.max(0, members.value.length - MAX_AVATARS)
)

const capMessageText = __('You can enroll up to {0} students at a time.', [
	MAX_STUDENTS,
])

const pickerModel = computed<string[]>({
	get: () => members.value.map((member) => optionFor(member).value),
	set: (next) => {
		const picked = new Set(next.map(keyOf))
		const kept = members.value.filter((member) => picked.has(keyOf(member)))
		const { members: capped, overflow } = mergeMembers(kept, next, MAX_STUDENTS)
		capMessage.value = overflow ? capMessageText : ''
		members.value = capped
	},
})

const looksLikeEmail = (value: string): boolean =>
	/^[^\s@]+@[^\s@]+$/.test(value)

const addEmails = (text: string): boolean => {
	const emails = parseEmailList(text).filter(looksLikeEmail)
	if (!emails.length) return false
	query.value = ''
	addEligible(emails)
	return true
}

const addEligible = async (emails: readonly string[]) => {
	const eligible = (await eligibleAmong(emails)) ?? []
	if (!eligible.length) return
	const { members: next, overflow } = mergeMembers(
		members.value,
		eligible,
		MAX_STUDENTS
	)
	members.value = next
	capMessage.value = overflow ? capMessageText : ''
}

watch(query, (text) => {
	if (/[,;\n]/.test(text)) addEmails(text)
	else runSearch(text)
})

useEventListener(
	document,
	'paste',
	(event: ClipboardEvent) => {
		const input = event.target as HTMLElement | null
		if (input?.id !== `${pickerId}-search-input`) return
		const text = event.clipboardData?.getData('text') ?? ''
		if (/[\s,;]/.test(text.trim()) && addEmails(text)) event.preventDefault()
	},
	{ capture: true }
)

const focusAfterRemoval = (index: number) => {
	const buttons =
		selectedList.value?.querySelectorAll<HTMLElement>('button') ?? []
	const target = buttons[index] ?? buttons[index - 1]
	if (target) target.focus()
	else selectRef.value?.focus()
}

const remove = async (member: string) => {
	const index = members.value.findIndex((m) => keyOf(m) === keyOf(member))
	members.value = members.value.filter((m) => keyOf(m) !== keyOf(member))
	capMessage.value = ''
	await nextTick()
	focusAfterRemoval(index)
}
</script>
