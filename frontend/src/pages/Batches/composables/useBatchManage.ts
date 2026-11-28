import { call, createResource, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { getCurrentInstance, inject, provide } from 'vue'
import type { InjectionKey } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { openBatchForm } from '@/composables/useBatchForms'
import type { BatchDetails, Resource } from '@/types'

type DialogFn = (options: {
	title: string
	message: string
	actions: {
		label: string
		theme?: string
		variant?: string
		onClick: (context: { close: () => void }) => void | Promise<unknown>
	}[]
}) => void

export interface BatchManage {
	publishing: () => boolean
	togglePublish: () => void
	deleteBatch: () => void
	generateCertificates: () => void
}

export const BATCH_MANAGE: InjectionKey<BatchManage> = Symbol('batchManage')

export function injectBatchManage(): BatchManage | null {
	return inject(BATCH_MANAGE, null)
}

/** Publish, delete and certificate actions for the header menu and Settings. */
export function useBatchManage(
	batch: Resource<BatchDetails | null>
): BatchManage {
	const router = useRouter()
	const route = useRoute()
	const { $dialog } = getCurrentInstance()!.appContext.config
		.globalProperties as { $dialog: DialogFn }

	const publishToggle = createResource({
		url: 'frappe.client.set_value',
		makeParams: () => ({
			doctype: 'LMS Batch',
			name: batch.data?.name,
			fieldname: 'published',
			value: batch.data?.published ? 0 : 1,
		}),
		onSuccess() {
			toast.success(
				batch.data?.published ? __('Batch unpublished') : __('Batch published')
			)
			batch.reload()
		},
		onError(error: FrappeResourceError) {
			toast.error(error.messages?.[0] || __('Could not update publish status'))
		},
	})

	function trashBatch(close: () => void): Promise<void> {
		return call('lms.lms.api.delete_batch', {
			batch: batch.data?.name,
		}).then(() => {
			toast.success(__('Batch deleted successfully'))
			close()
			router.push({ name: 'Batches' })
		})
	}

	function deleteBatch(): void {
		$dialog({
			title: __('Delete this batch?'),
			message: __(
				'Deleting this batch will also delete all its data including enrolled students, linked courses, assessments, feedback and discussions. Are you sure you want to continue?'
			),
			actions: [
				{
					label: __('Delete'),
					theme: 'red',
					variant: 'solid',
					onClick: ({ close }) => trashBatch(close),
				},
			],
		})
	}

	const manage: BatchManage = {
		publishing: () => Boolean(publishToggle.loading),
		togglePublish: () => {
			if (!publishToggle.loading) publishToggle.submit().catch(() => {})
		},
		deleteBatch,
		generateCertificates: () =>
			openBatchForm(
				router,
				'BulkCertificates',
				batch.data?.name ?? '',
				route.hash
			),
	}
	provide(BATCH_MANAGE, manage)
	return manage
}
