<template>
	<NotFound v-if="(batch.fetched || batch.error) && !batch.data?.name" />
	<div
		v-else
		class="flex flex-col"
		:class="page?.flowsWithPage ? 'min-h-full shrink-0' : 'h-full'"
	>
		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
		<StudentViewBar
			v-if="studentMode"
			v-model="studentMode"
			doctype="LMS Batch"
			:name="batchName"
			@exit="studentMode = null"
			@change="refreshStudentView"
		/>
		<TabbedDetailPage
			ref="page"
			:key="studentViewVersion"
			class="grow"
			:tabs="tabs"
			:breadcrumbs="breadcrumbs"
			:published="isAdmin && Boolean(batch.data?.published)"
			:loading="!batch.data"
			:doc="viewBatch"
			doc-prop="batch"
		>
			<template v-if="isAdmin" #status>
				<Badge :theme="batch.data?.published ? 'green' : 'amber'">
					{{ batch.data?.published ? __('Published') : __('Draft') }}
				</Badge>
				<Badge
					v-if="
						batch.data?.accept_enrollments && !batch.data?.enrollment_closes_on
					"
					theme="blue"
				>
					{{ __('Upcoming') }}
				</Badge>
			</template>

			<template #actions="{ tab }">
				<BatchHeaderActions
					v-if="isAdmin"
					:tab="tab?.key"
					:batch="batch"
					@student-view="openStudentView(tab?.key)"
				/>
				<DashboardTabActions
					v-if="isMobile && hasDashboardActions(tab?.key)"
					@export="exportAnalytics"
					@enroll="openForm('NewBatchStudent')"
				/>
				<HeaderButton
					v-if="isMobile && hasAnnouncementAction(tab?.key)"
					:label="__('Make announcement')"
					icon="lucide-send"
					@click="openForm('NewAnnouncement')"
				/>
			</template>

			<template #solo>
				<BatchOverview v-if="batch.data" :batch="viewBatch" />
				<SkeletonLoader v-else variant="course-page" />
			</template>

			<template #tab-row-end="{ tab }">
				<BatchSaveButton
					v-if="isAdmin && isFormTab(tab?.key) && !isMobile"
					:form="form"
				/>
				<DashboardTabActions
					v-if="!isMobile && hasDashboardActions(tab?.key)"
					@export="exportAnalytics"
					@enroll="openForm('NewBatchStudent')"
				/>
				<HeaderButton
					v-if="!isMobile && hasAnnouncementAction(tab?.key)"
					:label="__('Make announcement')"
					icon="lucide-send"
					@click="openForm('NewAnnouncement')"
				/>
			</template>

			<template #tab-body-discussions>
				<div class="w-[90%] lg:w-[75%] mx-auto mt-5">
					<Discussions
						doctype="LMS Batch"
						:docname="batch.data.name"
						:title="__('Discussions')"
						heading-size="lg"
						:key="batch.data.name"
						:singleThread="true"
						:scrollToBottom="false"
					/>
				</div>
			</template>
		</TabbedDetailPage>
	</div>
	<ExportAnalyticsDialog
		v-if="exportMounted"
		v-model:open="showExport"
		kind="batch"
		:name="batchName"
	/>

	<router-view />
</template>
<script setup>
import { computed, inject, markRaw, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, createResource, usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import AdminBatchDashboard from '@/pages/Batches/components/AdminBatchDashboard.vue'
import StudentBatchDashboard from '@/pages/Batches/components/BatchDashboard.vue'
import BatchOverview from '@/pages/Batches/BatchOverview.vue'
import LiveClass from '@/pages/Batches/components/LiveClass.vue'
import Announcements from '@/pages/Batches/components/Announcements.vue'
import BatchForm from '@/pages/Batches/BatchForm.vue'
import BatchHeaderActions from '@/pages/Batches/components/BatchHeaderActions.vue'
import BatchSaveButton from '@/pages/Batches/components/BatchSaveButton.vue'
import StudentViewBar from '@/components/StudentViewBar.vue'
import Discussions from '@/components/Discussions.vue'
import ExportAnalyticsDialog from '@/components/Dashboard/ExportAnalyticsDialog.vue'
import DashboardTabActions from '@/components/Dashboard/DashboardTabActions.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import TabbedDetailPage from '@/components/Layouts/pages/TabbedDetailPage.vue'
import NotFound from '@/pages/NotFound.vue'
import { canReadDiscussions } from '@/utils/doctypePermissions'
import { useScreenSize } from '@/utils/composables'
import { openBatchForm } from '@/composables/useBatchForms'
import { provideStudentView } from '@/composables/useStudentView'
import { provideDashboardState } from '@/composables/dashboard/useDashboard'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'
import { useBatchForm } from '@/pages/Batches/composables/useBatchForm'
import { useLoadingAnnouncement } from '@/utils/a11y'
import {
	confirmUnsavedChanges,
	useUnsavedChangesGuard,
} from '@/composables/useUnsavedChangesGuard'
import { useBatchManage } from '@/pages/Batches/composables/useBatchManage'
import {
	BATCH_PREVIEW,
	studentBatch,
} from '@/pages/Batches/composables/batchStudentView'

const route = useRoute()
const { isMobile } = useScreenSize()
const isFormTab = (key) => !key || ['overview', 'settings'].includes(key)
const { brand } = sessionStore()
const user = inject('$user')

const dashboardState = provideDashboardState()

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const batch = createResource({
	url: 'lms.lms.utils.get_batch_details',
	makeParams: () => ({
		batch: props.batchName,
	}),
	auto: true,
})

const loadingAnnouncement = useLoadingAnnouncement(
	() => !batch.data && !batch.error,
	() => (batch.data?.title ? __('{0} loaded').format(batch.data.title) : '')
)

// The router reuses this component when you go straight from one batch to
// another, so setup does not run a second time.
watch(
	() => props.batchName,
	() => batch.reload()
)

// The forms in the <router-view> below change what this endpoint reports.
provide('reloadBatchDetails', () => batch.reload())

// Its flow decides the root's height, so the sticky student view bar
// spans the whole page.
const page = ref(null)
/** null, or which learner the instructor is previewing the page as. */
const studentMode = ref(null)
provideStudentView(user, () => Boolean(studentMode.value))
provide(BATCH_PREVIEW, {
	enroll: () => (studentMode.value = 'enrolled'),
})

// Remounts the page so course progress refetches after enrolling or a reset.
const studentViewVersion = ref(0)
const refreshStudentView = () => {
	batch.reload()
	studentViewVersion.value++
}

const canManage = computed(() => {
	// is_moderator/is_evaluator are session-wide roles; can_manage is this
	// batch's own tag, since a Course Creator only manages batches they author.
	return Boolean(
		user.data?.is_moderator || user.data?.is_evaluator || batch.data?.can_manage
	)
})

const isAdmin = computed(() => canManage.value && !studentMode.value)

const isStudent = computed(() => {
	if (studentMode.value) return studentMode.value === 'enrolled'
	return Boolean(batch.data?.is_student)
})

const viewBatch = computed(() =>
	studentMode.value ? studentBatch(batch, isStudent.value) : batch
)

const form = useBatchForm(
	() => props.batchName,
	batch,
	() => isAdmin.value
)
useUnsavedChangesGuard({
	isDirty: () => form.isDirty.value,
	isSaving: () => form.isSaving.value,
	save: form.submitBatch,
	param: 'batchName',
})
useBatchManage(batch)

useKeyboardShortcuts({
	active: () =>
		isAdmin.value && ['', '#overview', '#settings'].includes(route.hash),
	shortcuts: [saveShortcut(() => form.submitBatch())],
})

const showExport = ref(false)
// Mounted on first use: most visits to the dashboard never export.
const exportMounted = ref(false)

const exportAnalytics = () => {
	exportMounted.value = true
	showExport.value = true
}

const router = useRouter()
const openForm = (name) => {
	openBatchForm(router, name, props.batchName, route.hash)
}

const hasDashboardActions = (tab) =>
	isAdmin.value && tab === 'dashboard' && dashboardState.value === 'ready'

const hasAnnouncementAction = (tab) =>
	isAdmin.value &&
	tab === 'announcements' &&
	!window.read_only_mode &&
	Boolean(batch.data?.student_count)

// Student view shows the stored batch, so unsaved edits are settled first.
const openStudentView = async (tab) => {
	const proceed = await confirmUnsavedChanges({
		isDirty: () => form.isDirty.value,
		isSaving: () => form.isSaving.value,
		save: form.submitBatch,
		discard: () => form.discardChanges?.(),
	})
	if (!proceed) return
	studentMode.value = !tab || tab === 'overview' ? 'not-enrolled' : 'enrolled'
}

const tabs = computed(() => {
	const enrolled = isAdmin.value || isStudent.value
	return [
		{
			key: 'overview',
			label: __('Overview'),
			component: markRaw(BatchOverview),
			icon: 'lucide-list',
			when: enrolled,
			flow: true,
			rendersHeading: true,
		},
		{
			key: 'dashboard',
			label: __('Dashboard'),
			component: markRaw(AdminBatchDashboard),
			icon: 'lucide-trending-up',
			when: isAdmin.value,
		},
		{
			key: 'dashboard',
			label: __('Dashboard'),
			component: markRaw(StudentBatchDashboard),
			icon: 'lucide-clipboard-pen',
			when: !isAdmin.value && isStudent.value,
		},
		{
			key: 'classes',
			label: __('Classes'),
			component: markRaw(LiveClass),
			icon: 'lucide-laptop',
			when: enrolled,
		},
		{
			key: 'announcements',
			label: __('Announcements'),
			component: markRaw(Announcements),
			icon: 'lucide-mail',
			when: enrolled,
		},
		{
			key: 'discussions',
			label: __('Discussions'),
			component: markRaw(Discussions),
			icon: 'lucide-message-circle',
			when: enrolled && canReadDiscussions(user),
		},
		{
			key: 'settings',
			label: __('Settings'),
			component: markRaw(BatchForm),
			icon: 'lucide-settings-2',
			when: isAdmin.value,
			flow: true,
		},
	]
})

const breadcrumbs = computed(() => {
	const crumbs = [{ label: __('Batches'), route: { name: 'Batches' } }]
	if (batch.data) {
		crumbs.push({
			label: batch.data.title,
			route: { name: 'BatchDetail', params: { batchName: batch.data.name } },
		})
	}
	return crumbs
})

usePageMeta(() => {
	return {
		title: batch?.data?.title,
		icon: brand.favicon,
	}
})
</script>
<style>
.batch-description p {
	margin-bottom: 1rem;
	line-height: 1.7;
}

.batch-description li {
	line-height: 1.7;
}

.batch-description ol {
	list-style: auto;
	margin: revert;
	padding: revert;
}

.batch-description strong {
	font-weight: 600;
	color: var(--ink-gray-9) !important;
}
</style>
