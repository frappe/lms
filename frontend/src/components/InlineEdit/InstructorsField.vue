<template>
	<MultiLink
		ref="picker"
		v-model="instructors"
		doctype="User"
		url="lms.lms.api.search_users_by_role"
		:searchParams="{ roles: JSON.stringify(roles) }"
		:transform="toOptions"
		:extraOptions="knownSelected"
		:placeholder="__('Add instructors')"
		:aria-label="__('Instructors')"
		variant="ghost"
		v-bind="$attrs"
		class="rounded-4"
		:class="missingRing(missing)"
		:onCreate="openMemberModal"
	>
		<template #prefix>
			<div
				v-if="instructors.length"
				class="flex -space-x-1.5 rtl:space-x-reverse"
			>
				<Avatar
					v-for="person in visibleAvatars"
					:key="person.value"
					:image="person.image"
					:label="person.label"
					size="sm"
				/>
			</div>
			<span v-else class="lucide-user-plus size-4 text-ink-gray-5" />
		</template>
		<template #summary>
			<span :class="instructors.length ? 'text-ink-gray-7' : 'text-ink-gray-4'">
				{{ summary }}
			</span>
		</template>
		<template #item-prefix="{ item }">
			<Avatar :image="item.image" :label="item.label" size="sm" />
		</template>
		<template #item-label="{ item }">
			<div class="flex min-w-0 justify-between gap-2">
				<div class="truncate">{{ item.label }}</div>
				<div class="truncate text-p-xs text-ink-gray-6">{{ item.value }}</div>
			</div>
		</template>
	</MultiLink>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="[memberRole]"
		@created="onMemberCreated"
	/>
</template>

<script setup lang="ts">
import { Avatar, createResource } from 'frappe-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import { missingRing } from '@/components/InlineEdit/fieldClasses'
import { summarisePeople } from '@/utils/peopleSummary'

interface PersonOption {
	label: string
	value: string
	image: string
}
interface UserHit {
	label?: string
	value?: string
	name?: string
	user_image?: string
	description?: string
}

/**
 * Instructors as avatars and a name summary, picked in place. `memberRole`
 * is the role a member created from the picker starts with.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
	defineProps<{
		memberRole: 'course_creator' | 'batch_evaluator'
		missing?: boolean
		roles?: string[]
	}>(),
	{ roles: () => ['Course Creator', 'Batch Evaluator'] }
)
const instructors = defineModel<string[]>({ required: true })

const MAX_VISIBLE_AVATARS = 3

const picker = useTemplateRef<{ reload: () => void }>('picker')
const showMemberModal = ref(false)
const known = ref(new Map<string, PersonOption>())

function toOptions(rows: Record<string, unknown>[]): PersonOption[] {
	return (rows as UserHit[]).map((row) => ({
		label: row.label || row.description || row.value || row.name || '',
		value: row.value || row.name || '',
		image: row.user_image || '',
	}))
}

// Saved instructors arrive as bare user ids; look up their names and avatars.
const lookup = createResource({
	url: 'lms.lms.api.search_users_by_role',
	method: 'POST',
	makeParams: () => ({
		roles: JSON.stringify(props.roles),
		names: JSON.stringify(instructors.value),
	}),
	onSuccess(rows: UserHit[]) {
		const next = new Map(known.value)
		for (const option of toOptions(rows as Record<string, unknown>[])) {
			if (option.value) next.set(option.value, option)
		}
		known.value = next
	},
})

watch(
	instructors,
	(ids) => {
		if (ids.some((id) => !known.value.has(id))) lookup.reload()
	},
	{ immediate: true }
)

const describe = (id: string): PersonOption =>
	known.value.get(id) ?? { label: id, value: id, image: '' }

const knownSelected = computed(() =>
	instructors.value.filter((id) => known.value.has(id)).map(describe)
)
const visibleAvatars = computed(() =>
	instructors.value.slice(0, MAX_VISIBLE_AVATARS).map(describe)
)
const summary = computed(() =>
	instructors.value.length
		? summarisePeople(instructors.value.map((id) => describe(id).label))
		: __('Add instructors')
)

function openMemberModal(close: () => void): void {
	close()
	showMemberModal.value = true
}

function onMemberCreated(user: { name: string }): void {
	instructors.value = [...instructors.value, user.name]
	picker.value?.reload()
}
</script>
