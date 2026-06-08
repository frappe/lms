<template>
	<div v-if="instructors?.length" class="border-2 rounded-md p-5">
		<div
			class="uppercase text-ink-gray-5 text-xs font-semibold tracking-wider mb-4"
		>
			{{ headerLabel }}
		</div>

		<template v-if="instructors.length === 1">
			<router-link
				:to="profileLink(instructors[0])"
				class="flex items-center gap-3"
			>
				<UserAvatar :user="instructors[0]" size="2xl" />
				<div class="min-w-0">
					<div class="font-medium text-ink-gray-9 truncate">
						{{ instructors[0].full_name }}
					</div>
				</div>
			</router-link>
			<div
				v-if="hasBio(instructors[0].bio)"
				v-html="renderBio(instructors[0].bio)"
				class="ProseMirror prose prose-sm max-w-none text-p-sm text-ink-gray-7 leading-6 mt-4 line-clamp-3"
			></div>
		</template>

		<template v-else>
			<router-link
				v-if="focused"
				:to="profileLink(focused)"
				class="flex items-center gap-3"
			>
				<UserAvatar :user="focused" size="2xl" />
				<div class="min-w-0">
					<div class="font-medium text-ink-gray-9 truncate">
						{{ focused.full_name }}
					</div>
				</div>
			</router-link>
			<div
				v-if="hasBio(focused?.bio)"
				v-html="renderBio(focused?.bio)"
				class="ProseMirror prose prose-sm max-w-none text-p-sm text-ink-gray-7 leading-6 mt-4 line-clamp-3"
			></div>

			<div class="mt-4 pt-4 border-t border-outline-gray-2">
				<div
					class="uppercase text-ink-gray-5 text-xs font-semibold tracking-wider mb-3"
				>
					{{ __('Also teaching') }}
				</div>
				<div class="flex items-center gap-2 min-w-0">
					<div class="flex items-center shrink-0">
						<button
							v-for="(instructor, idx) in visiblePeers"
							:key="instructor.username || instructor.name || idx"
							type="button"
							class="rounded-full hover:-translate-y-0.5 transition -ms-1.5 first:ms-0"
							@click="focusInstructor(instructor)"
						>
							<UserAvatar :user="instructor" size="md" />
						</button>
						<button
							v-if="hiddenPeerCount > 0"
							type="button"
							class="-ms-1.5 flex items-center justify-center size-6 rounded-full bg-surface-gray-3 text-xs font-medium text-ink-gray-7 hover:bg-surface-gray-4 transition"
							@click="expanded = true"
						>
							+{{ hiddenPeerCount }}
						</button>
					</div>
					<div class="text-sm text-ink-gray-7 truncate">
						{{ peers.map(firstName).join(', ') }}
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import UserAvatar from '@/components/UserAvatar.vue'
import { decodeEntities, htmlToText } from '@/utils'
import type { CourseInstructorInfo } from '@/types/api'

const props = defineProps<{
	instructors: CourseInstructorInfo[]
}>()

const focusedKey = ref<string | null>(null)

const instructorKey = (i: CourseInstructorInfo) =>
	i.username || i.name || i.full_name || ''

const firstName = (i: CourseInstructorInfo) =>
	(i.first_name || i.full_name || '').split(' ')[0]

watch(
	() => props.instructors,
	(list) => {
		if (!list?.length) {
			focusedKey.value = null
			return
		}
		const stillThere =
			focusedKey.value &&
			list.some((i) => instructorKey(i) === focusedKey.value)
		if (!stillThere) focusedKey.value = instructorKey(list[0])
	},
	{ immediate: true }
)

const focused = computed<CourseInstructorInfo | null>(() => {
	const list = props.instructors || []
	return (
		list.find((i) => instructorKey(i) === focusedKey.value) || list[0] || null
	)
})

const peers = computed<CourseInstructorInfo[]>(() =>
	(props.instructors || []).filter((i) => instructorKey(i) !== focusedKey.value)
)

const MAX_VISIBLE_PEERS = 2
const expanded = ref<boolean>(false)

const visiblePeers = computed<CourseInstructorInfo[]>(() =>
	expanded.value ? peers.value : peers.value.slice(0, MAX_VISIBLE_PEERS)
)

const hiddenPeerCount = computed<number>(() =>
	expanded.value ? 0 : Math.max(0, peers.value.length - MAX_VISIBLE_PEERS)
)

const headerLabel = computed<string>(() => {
	const n = props.instructors?.length || 0
	if (n <= 1) return __('Course creator')
	if (n <= 4) return __('Taught by')
	return __('Taught by a team of {0}').format(String(n))
})

function hasBio(bio?: string | null): boolean {
	if (!bio) return false
	return htmlToText(bio).trim().length > 0 || /<img\b/i.test(bio)
}

function renderBio(bio?: string | null): string {
	return DOMPurify.sanitize(decodeEntities(bio || ''), {
		ALLOWED_TAGS: [
			'b',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'br',
			'ul',
			'ol',
			'li',
			'img',
		],
		ALLOWED_ATTR: ['href', 'target', 'rel', 'src'],
	})
}

function profileLink(instructor: CourseInstructorInfo) {
	return { name: 'Profile', params: { username: instructor.username } }
}

function focusInstructor(instructor: CourseInstructorInfo) {
	focusedKey.value = instructorKey(instructor)
}
</script>
