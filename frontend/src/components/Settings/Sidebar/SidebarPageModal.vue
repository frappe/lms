<template>
	<Dialog
		v-model="open"
		:options="{
			title: page ? __('Edit sidebar link') : __('Add link to sidebar'),
			size: 'lg',
			actions: [
				{
					label: page ? __('Save') : __('Add'),
					variant: 'solid',
					loading: resource.loading,
					onClick: submit,
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4 text-base">
				<Link
					data-testid="page-web-page"
					v-model="draft.web_page"
					doctype="Web Page"
					:label="__('Web Page')"
					:filters="{ published: 1 }"
					:disabled="Boolean(page)"
				/>
				<IconPicker
					data-testid="page-icon"
					v-model="draft.icon"
					:label="__('Icon')"
				/>
				<ErrorMessage v-if="error" :message="error" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Dialog, ErrorMessage, createResource, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import IconPicker from '@/components/Controls/IconPicker.vue'
import { cleanError } from '@/utils'
import type { LMSSidebarItem } from '@/types/lms/LMSSidebarItem'

const open = defineModel<boolean>({ required: true })

// The row being re-iconed, or null to add a new page. Only its web_page and
// icon matter; the web page itself is fixed on an edit.
const props = defineProps<{ page: LMSSidebarItem | null }>()
const emit = defineEmits<{ saved: [] }>()

const draft = reactive({ web_page: '', icon: '' })
const error = ref('')

// Watches `open` too: `openModal(null)` assigns null over null, which is not
// a change, so a second New reopened the dialog holding the last attempt,
// and Add re-submitted it, re-iconing the row that attempt had already created.
watch(
	[() => props.page, open],
	([page, isOpen]) => {
		if (!isOpen) return
		draft.web_page = page?.web_page ?? ''
		draft.icon = page?.icon ?? ''
		error.value = ''
	},
	{ immediate: true }
)

const resource = createResource({
	url: 'lms.lms.api.update_sidebar_item',
	makeParams: () => ({ webpage: draft.web_page, icon: draft.icon }),
})

const submit = ({ close }: { close: () => void }) => {
	error.value = ''
	if (!draft.web_page) {
		error.value = __('Choose the web page this link opens.')
		return
	}
	resource.submit(
		{},
		{
			onSuccess() {
				emit('saved')
				close()
				toast.success(
					props.page
						? __('Sidebar link updated')
						: __('Web page added to sidebar')
				)
			},
			onError(err: any) {
				error.value =
					cleanError(err?.messages?.[0]) || __('Error saving the link')
			},
		}
	)
}
</script>
