<template>
	<template v-if="refusing" />
	<Dialog
		v-else-if="!isMobile"
		:open="true"
		:title="title"
		:size="size"
		:position="position"
		@update:open="onDialogToggle"
	>
		<template #title>
			<div class="flex flex-1 items-center justify-between gap-2">
				<h3 class="text-2xl-semibold leading-6 text-ink-gray-8">
					{{ title }}
				</h3>
				<slot name="header-action" />
			</div>
		</template>
		<template #default>
			<!-- The fields scroll inside the dialog so the title and the submit
			     button stay in view on a short screen. 17rem is the dialog's own
			     margins, header and footer. The side padding keeps focus rings
			     and full-bleed list rows from being clipped. -->
			<div
				data-testid="form-shell-dialog-body"
				class="-mx-3 overflow-y-auto px-3"
				:class="
					position === 'top'
						? 'max-h-[calc(80dvh-17rem)]'
						: 'max-h-[calc(100dvh-17rem)]'
				"
			>
				<slot v-if="loading" name="loading">
					<ModalLoading :class="statusClass" />
				</slot>
				<slot v-else />
			</div>
		</template>
		<template v-if="!loading" #actions>
			<div class="flex justify-end gap-2">
				<slot name="actions" />
			</div>
		</template>
	</Dialog>

	<MobilePage
		v-if="!refusing"
		:title="title"
		testid="form-shell"
		@close="emit('close')"
	>
		<template #actions>
			<slot name="header-action" />
			<slot v-if="!loading" name="actions" />
		</template>
		<slot v-if="loading" name="loading">
			<ModalLoading class="h-full" :class="statusClass" />
		</slot>
		<slot v-else />
	</MobilePage>
</template>
<script setup lang="ts">
// Below the breakpoint the form is a MobilePage, which owns the page's focus,
// Escape, Tab cycle and inert background.
//
// `actions` renders in the header on mobile and in the Dialog's footer on
// desktop. Pass HeaderButton, never a bare frappe-ui Button — Button.vue only
// applies square icon-button sizing when the slot's vnode type name starts with
// `lucide-`, which a plain `<span class="lucide-save">` does not satisfy.
import { Dialog, toast } from 'frappe-ui'
import type { DialogPosition, DialogSize } from 'frappe-ui'
import { computed, watch } from 'vue'
import { useScreenSize } from '@/utils/composables'
import MobilePage from '@/components/MobilePage.vue'
import ModalLoading from '@/components/ModalLoading.vue'

// `position="top"` keeps a form whose height changes (a message appearing above
// Save) from shifting the whole dialog, as a centred one does.
//
// `loading` replaces the fields with one centred spinner and hides the
// actions. A form can pass a skeleton in the `loading` slot instead.
// `message` is why the form can't be used ("not permitted", "no students"): it
// shows as a toast and the form closes without opening. Loading wins, so a
// refusal that reads data still loading waits for it.
// `statusClass` sizes the spinner box for a form whose body has a fixed height.
const props = withDefaults(
	defineProps<{
		title: string
		size?: DialogSize
		position?: DialogPosition
		loading?: boolean
		message?: string | null
		statusClass?: string
	}>(),
	{
		size: '3xl',
		position: 'center',
		loading: false,
		message: null,
		statusClass: '',
	}
)

const emit = defineEmits<{ close: [] }>()

const refusing = computed(() => !props.loading && Boolean(props.message))

watch(
	refusing,
	(isRefusing) => {
		if (!isRefusing) return
		toast.warning(props.message as string)
		emit('close')
	},
	{ immediate: true }
)
const { isMobile } = useScreenSize()

// The desktop Dialog owns its own dismiss affordances (Escape, backdrop, the
// header X); the route is the single source of truth for whether we are open.
const onDialogToggle = (open: boolean): void => {
	if (!open) emit('close')
}
</script>
