<template>
	<div class="space-y-2">
		<MultiLink
			ref="multiLinkRef"
			v-model="pickerModel"
			v-model:query="query"
			doctype="User"
			url="lms.lms.api.search_users_to_enroll"
			:searchParams="searchParams"
			variant="outline"
			:label="__('Students')"
			:error="capMessage"
			:onCreate="openMemberSettings"
		/>
		<div v-if="members.length" ref="chipList" class="flex flex-wrap gap-1">
			<Button
				v-for="member in members"
				:key="member"
				data-testid="student-chip"
				variant="subtle"
				:aria-label="__('Remove {0}', [labelFor(member)])"
				@click="remove(member)"
			>
				{{ labelFor(member) }}
				<template #suffix>
					<span class="lucide-x size-3.5" aria-hidden="true" />
				</template>
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import {
	MAX_STUDENTS,
	mergeMembers,
	parseEmailList,
} from '@/components/Enrollment/enrollment'
import { openSettings } from '@/utils'
import type { EnrollTargetDoctype } from '@/types'

const props = defineProps<{
	enrollDoctype: EnrollTargetDoctype
	enrollDocname: string
	includeEnrolled: boolean
}>()

const members = defineModel<string[]>({ default: () => [] })

const query = ref<string>('')
const capMessage = ref<string>('')
const multiLinkRef = ref<InstanceType<typeof MultiLink> | null>(null)
const chipList = ref<HTMLElement | null>(null)

const searchParams = computed(() => ({
	enroll_doctype: props.enrollDoctype,
	enroll_docname: props.enrollDocname,
	include_enrolled: props.includeEnrolled,
}))

// MultiLink only knows labels for its latest search page and for names it
// resolved, so a pick drops its label on the next search. Keep the first real
// name seen for each member.
const knownLabels = reactive(new Map<string, string>())

watch(
	() => [members.value, multiLinkRef.value?.optionByValue] as const,
	([list, options]) => {
		for (const member of list) {
			const label = options?.get(member)?.label
			if (label && label !== member) knownLabels.set(member, label)
		}
	},
	{ immediate: true }
)

const labelFor = (member: string): string => knownLabels.get(member) ?? member

const focusAfterRemoval = (index: number) => {
	const chips = chipList.value?.querySelectorAll<HTMLElement>('button') ?? []
	const target = chips[index] ?? chips[index - 1]
	if (target) target.focus()
	else multiLinkRef.value?.focus()
}

const remove = async (member: string) => {
	const index = members.value.indexOf(member)
	members.value = members.value.filter((m) => m !== member)
	capMessage.value = ''
	await nextTick()
	focusAfterRemoval(index)
}

const capMessageText = __('You can enroll up to {0} students at a time.', [
	MAX_STUDENTS,
])

const pickerModel = computed<string[]>({
	get: () => members.value,
	set: (next) => {
		const capped = next.slice(0, MAX_STUDENTS)
		capMessage.value = next.length > MAX_STUDENTS ? capMessageText : ''
		members.value = capped
	},
})

const looksLikeEmail = (value: string): boolean =>
	/^[^\s@]+@[^\s@]+$/.test(value)

watch(query, (text) => {
	if (!/[,;\n]/.test(text)) return
	const emails = parseEmailList(text).filter(looksLikeEmail)
	if (!emails.length) return
	const { members: next, overflow } = mergeMembers(
		members.value,
		emails,
		MAX_STUDENTS
	)
	members.value = next
	capMessage.value = overflow ? capMessageText : ''
	query.value = ''
})

const openMemberSettings = () => {
	openSettings('members')
}
</script>
