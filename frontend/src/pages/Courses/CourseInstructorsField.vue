<template>
	<MultiLink
		ref="multiLinkRef"
		v-model="instructors"
		doctype="User"
		url="lms.lms.api.search_users_by_role"
		:searchParams="{ roles: JSON.stringify(ROLES) }"
		:transform="transformUsers"
		:extraOptions="resolvedSelected"
		:label="__('Instructors')"
		:placeholder="__('Select instructors')"
		:required="true"
		variant="outline"
		:onCreate="openMemberModal"
		@update:modelValue="markDirty()"
	>
		<template #prefix>
			<div v-if="visibleAvatars.length" class="flex -space-x-1.5">
				<Avatar
					v-for="m in visibleAvatars"
					:key="m.value"
					:image="m.image"
					:label="m.label"
					size="sm"
				/>
				<span
					v-if="overflowCount > 0"
					class="z-10 grid size-5 place-items-center rounded-full bg-surface-gray-3 text-xs font-medium text-ink-gray-7"
				>
					+{{ overflowCount }}
				</span>
			</div>
			<Users v-else class="size-4 stroke-1.5 text-ink-gray-5" />
		</template>
		<template #item-prefix="{ item }">
			<Avatar :image="item.image" :label="item.label" size="sm" />
		</template>
		<template #item-label="{ item }">
			<div class="min-w-0 flex justify-between gap-2">
				<div class="truncate">{{ item.label }}</div>
				<div class="truncate text-xs text-ink-gray-5">{{ item.value }}</div>
			</div>
		</template>
	</MultiLink>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['course_creator']"
		@created="onMemberCreated"
	/>
</template>

<script setup lang="ts">
import { Avatar, createResource } from 'frappe-ui'
import { Users } from 'lucide-vue-next'
import { computed, inject, ref, watch } from 'vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import type { CourseFormContext, Resource } from '@/types/api'

interface InstructorOption {
	label: string
	value: string
	image: string
	description: string
}
interface RawUserHit {
	label?: string
	value?: string
	name?: string
	user_image?: string
	description?: string
}

const { instructors, markDirty } = inject<CourseFormContext>('courseForm')!

const ROLES = ['Course Creator', 'Batch Evaluator']
const MAX_VISIBLE_AVATARS = 3

const showMemberModal = ref<boolean>(false)
const multiLinkRef = ref<{
	optionByValue: Map<string, InstructorOption>
	reload: () => void
} | null>(null)

function transformUsers(rows: Record<string, unknown>[]): InstructorOption[] {
	return (rows as RawUserHit[]).map((o) => ({
		label: o.label || o.value || o.name || '',
		value: o.value || o.name || '',
		image: o.user_image || '',
		description: o.description || o.value || '',
	}))
}

// Hydrate the chip labels/avatars for instructors saved on the doc — the
// search endpoint only returns query matches, so without this the chips
// show raw user IDs (emails) after a page refresh.
const resolvedDetails = ref<Map<string, InstructorOption>>(new Map())

const selectedDetails = createResource({
	url: 'lms.lms.api.search_users_by_role',
	method: 'POST',
	makeParams: () => ({
		roles: JSON.stringify(ROLES),
		names: JSON.stringify(instructors.value),
	}),
	onSuccess(rows: RawUserHit[]) {
		const next = new Map(resolvedDetails.value)
		for (const u of rows) {
			const value = u.value || u.name || ''
			if (!value) continue
			next.set(value, {
				label: u.label || u.description || value,
				value,
				image: u.user_image || '',
				description: u.description || value,
			})
		}
		resolvedDetails.value = next
	},
}) as Resource<RawUserHit[] | null>

watch(
	instructors,
	(vals) => {
		const missing = (vals || []).filter((v) => !resolvedDetails.value.has(v))
		if (missing.length) selectedDetails.reload()
	},
	{ immediate: true }
)

const resolvedSelected = computed<InstructorOption[]>(() =>
	instructors.value
		.map((v) => resolvedDetails.value.get(v))
		.filter((o): o is InstructorOption => Boolean(o))
)

const optionByValue = computed<Map<string, InstructorOption>>(() => {
	const merged = new Map<string, InstructorOption>(resolvedDetails.value)
	const fromMultiLink = multiLinkRef.value?.optionByValue
	if (fromMultiLink) {
		fromMultiLink.forEach((v, k) => merged.set(k, v))
	}
	return merged
})

const visibleAvatars = computed<InstructorOption[]>(() =>
	instructors.value
		.slice(0, MAX_VISIBLE_AVATARS)
		.map(
			(v) =>
				optionByValue.value.get(v) ||
				({
					value: v,
					label: v,
					image: '',
					description: '',
				} as InstructorOption)
		)
		.filter((o): o is InstructorOption => Boolean(o))
)

const overflowCount = computed<number>(() =>
	Math.max(0, instructors.value.length - MAX_VISIBLE_AVATARS)
)

function openMemberModal(close: () => void) {
	close()
	showMemberModal.value = true
}

function onMemberCreated(user: { name: string }) {
	instructors.value = [...instructors.value, user.name]
	multiLinkRef.value?.reload()
	markDirty()
}
</script>
