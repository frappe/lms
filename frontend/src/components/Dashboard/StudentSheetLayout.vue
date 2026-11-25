<template>
	<DefineBody>
		<div v-if="failed" class="flex min-h-0 flex-1 px-6">
			<LoadError compact :error="error ?? null" @retry="emit('retry')" />
		</div>
		<div
			v-else-if="skeleton"
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain md:flex md:overflow-hidden"
			aria-hidden="true"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-7 px-6 pb-7 pt-5">
				<div
					class="flex flex-col gap-3 rounded-[12px] bg-surface-gray-1 px-[18px] py-[14px]"
				>
					<Skeleton class="h-2 w-32 rounded-full" />
					<Skeleton class="h-2 w-full rounded-full" />
					<Skeleton class="h-2 w-2/3 rounded-full" />
				</div>
				<div v-for="section in 2" :key="section" class="flex flex-col gap-4">
					<Skeleton class="h-2 w-24 rounded-full" />
					<div
						v-for="row in 3"
						:key="row"
						class="flex items-center justify-between gap-4"
					>
						<Skeleton class="h-2 w-1/2 rounded-full" />
						<Skeleton class="h-2 w-14 rounded-full" />
					</div>
				</div>
			</div>
			<div
				class="flex flex-col gap-[14px] border-t border-outline-gray-1 px-6 pb-7 pt-5 md:w-[340px] md:pt-3.5 md:shrink-0 md:border-s md:border-t-0"
			>
				<Skeleton class="h-2 w-16 rounded-full" />
				<div
					v-for="row in 4"
					:key="row"
					class="flex items-center gap-[14px] pb-[14px]"
				>
					<Skeleton class="size-[7px] shrink-0 rounded-full" />
					<Skeleton class="h-2 flex-1 rounded-full" />
					<Skeleton class="h-2 w-10 shrink-0 rounded-full" />
				</div>
			</div>
		</div>
		<div
			v-else
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain md:flex md:overflow-hidden"
		>
			<div
				class="flex min-w-0 flex-1 flex-col gap-7 px-6 pb-7 pt-5 md:overflow-y-auto md:overscroll-contain"
			>
				<slot />
			</div>

			<aside
				class="flex flex-col gap-[14px] border-t border-outline-gray-1 px-6 pb-7 pt-5 md:w-[340px] md:pt-3.5 md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-s md:border-t-0"
				:aria-label="__('Activity')"
			>
				<h3 class="text-[14px] font-semibold text-ink-gray-8">
					{{ __('Activity') }}
				</h3>
				<p v-if="activityNote" class="text-[13px] text-ink-gray-6">
					{{ activityNote }}
				</p>
				<ol v-else class="flex flex-col">
					<li
						v-for="(event, index) in timeline"
						:key="index"
						class="flex gap-[14px]"
					>
						<span
							class="flex w-2 shrink-0 flex-col items-center"
							aria-hidden="true"
						>
							<span class="mt-1.5 size-[7px] rounded-full" :class="event.dot" />
							<span class="mt-1.5 w-0 flex-1 border-s border-outline-gray-1" />
						</span>
						<span
							class="flex min-w-0 flex-1 items-baseline justify-between gap-4 pb-[14px] text-[13px] leading-[1.5]"
						>
							<span class="text-pretty text-ink-gray-7">
								{{ event.text }}
							</span>
							<span class="shrink-0 text-[12px] text-ink-gray-6">
								{{ event.when }}
							</span>
						</span>
					</li>
				</ol>
			</aside>
		</div>
	</DefineBody>
	<Dialog v-if="!isMobile" v-model:open="show" size="5xl" bare>
		<div v-bind="$attrs" class="flex h-[min(700px,calc(100vh-96px))] flex-col">
			<header
				class="flex shrink-0 items-start gap-3 border-b border-outline-gray-1 pb-4 pe-4 ps-6 pt-6"
			>
				<Skeleton v-if="skeleton" class="size-10 shrink-0 rounded-full" />
				<Avatar
					v-else-if="name"
					:image="image ?? undefined"
					:label="name"
					size="2xl"
				/>
				<div class="flex min-w-0 flex-1 flex-col pt-0.5">
					<Dialog.Title
						class="truncate text-[16px] font-semibold text-ink-gray-8"
						:class="{ 'sr-only': skeleton }"
					>
						{{ name ?? __('Student progress') }}
					</Dialog.Title>
					<div v-if="skeleton" class="flex flex-col gap-2.5 pt-1.5">
						<Skeleton class="h-2 w-40 rounded-full" />
						<Skeleton class="h-2 w-28 rounded-full" />
					</div>
					<p v-if="subtitle" class="truncate text-[13px] text-ink-gray-6">
						{{ subtitle }}
					</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1.5">
					<div class="flex items-center gap-1">
						<Badge
							v-if="badge"
							size="md"
							:theme="badge.theme"
							:label="badge.label"
						/>
						<Button
							size="sm"
							variant="ghost"
							icon="lucide-x"
							:aria-label="__('Close')"
							@click="show = false"
						/>
					</div>
					<span
						v-if="lastActive"
						class="whitespace-nowrap pe-8 text-[12px] text-ink-gray-6"
					>
						{{ lastActive }}
					</span>
				</div>
			</header>
			<ReuseBody />
			<footer
				v-if="!failed && !skeleton"
				class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-gray-1 px-6 py-3"
			>
				<Button
					size="sm"
					variant="subtle"
					theme="red"
					:label="removal.label"
					@click="showRemoveDialog = true"
				/>
				<Button
					v-if="primaryAction"
					size="sm"
					variant="solid"
					:label="primaryAction.label"
					:loading="primaryAction.loading"
					@click="primaryAction.run"
				/>
			</footer>
		</div>
	</Dialog>
	<MobilePage
		v-else-if="show"
		:title="name ?? __('Student progress')"
		body-class="overflow-y-auto overscroll-contain"
		@close="show = false"
	>
		<template v-if="!failed && !skeleton" #actions>
			<HeaderButton
				icon="lucide-user-minus"
				theme="red"
				variant="subtle"
				:label="removal.label"
				@click="showRemoveDialog = true"
			/>
			<HeaderButton
				v-if="primaryAction"
				variant="solid"
				:label="primaryAction.label"
				:loading="primaryAction.loading"
				@click="primaryAction.run"
			/>
		</template>
		<div v-bind="$attrs" class="flex min-h-full flex-col">
			<div
				v-if="!failed"
				class="flex shrink-0 items-center gap-3 border-b border-outline-gray-1 px-6 py-4"
			>
				<Skeleton v-if="skeleton" class="size-10 shrink-0 rounded-full" />
				<Avatar
					v-else-if="name"
					:image="image ?? undefined"
					:label="name"
					size="2xl"
				/>
				<div v-if="skeleton" class="flex flex-1 flex-col gap-2.5">
					<Skeleton class="h-2 w-40 rounded-full" />
					<Skeleton class="h-2 w-28 rounded-full" />
				</div>
				<div v-else class="flex min-w-0 flex-1 flex-col gap-1">
					<p v-if="subtitle" class="truncate text-[13px] text-ink-gray-6">
						{{ subtitle }}
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<Badge
							v-if="badge"
							size="md"
							:theme="badge.theme"
							:label="badge.label"
						/>
						<span v-if="lastActive" class="text-[12px] text-ink-gray-6">
							{{ lastActive }}
						</span>
					</div>
				</div>
			</div>
			<ReuseBody />
		</div>
	</MobilePage>
	<Dialog
		v-model:open="showRemoveDialog"
		:title="removal.title"
		:message="removal.message"
		size="sm"
		:actions="removeActions"
	/>
</template>
<script setup lang="ts">
import { Avatar, Badge, Button, call, Dialog, Skeleton, toast } from 'frappe-ui'
import type { BadgeProps, DialogAction } from 'frappe-ui'
import { computed, ref } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import HeaderButton from '@/components/HeaderButton.vue'
import LoadError from '@/components/LoadError.vue'
import MobilePage from '@/components/MobilePage.vue'
import { useScreenSize } from '@/utils/composables'
import { resourceErrorMessage } from '@/utils/resource'
import type { SheetAction, SheetEvent } from '@/utils/dashboard/studentSheet'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	name: string | null
	subtitle: string
	image: string | null
	badge: { label: string; theme: BadgeProps['theme'] } | null
	lastActive: string
	/** The student has loaded; until then the sheet is a skeleton or an error. */
	ready: boolean
	error?: unknown
	timeline: SheetEvent[]
	activityNote?: string
	primaryAction: SheetAction | null
	removal: {
		label: string
		title: string
		message: string
		doctype: string
		enrollment: string
		removed: string
	}
}>()

const emit = defineEmits<{
	removed: []
	retry: []
}>()

const failed = computed<boolean>(() => !props.ready && Boolean(props.error))
const skeleton = computed<boolean>(() => !props.ready && !props.error)

const show = defineModel<boolean>({ required: true })

// The page's h1 names it on a phone; Dialog.Title only exists inside Dialog.
const { isMobile } = useScreenSize()
const [DefineBody, ReuseBody] = createReusableTemplate()
const showRemoveDialog = ref<boolean>(false)

const remove = async (close: () => void): Promise<void> => {
	try {
		await call('frappe.client.delete', {
			doctype: props.removal.doctype,
			name: props.removal.enrollment,
		})
	} catch (error) {
		toast.error(resourceErrorMessage(error, __('Could not remove student')))
		return
	}
	toast.success(props.removal.removed)
	close()
	show.value = false
	emit('removed')
}

const removeActions = computed<DialogAction[]>(() => [
	{ label: __('Cancel'), onClick: ({ close }) => close() },
	{
		label: __('Remove'),
		variant: 'solid',
		theme: 'red',
		onClick: ({ close }) => remove(close),
	},
])
</script>
