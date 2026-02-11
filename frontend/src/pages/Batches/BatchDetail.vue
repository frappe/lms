<template>
	<div v-if="batch.data" class="">
		<header
			class="sticky top-0 z-10 border-b flex items-center justify-between bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
			<div v-if="tabIndex == 5" class="flex items-center space-x-2">
				<Badge v-if="childRef?.isDirty" theme="orange">
					{{ __('Not Saved') }}
				</Badge>
				<Button @click="childRef.trashCourse()">
					<template #icon>
						<Trash2 class="w-4 h-4 stroke-1.5" />
					</template>
				</Button>
				<Button variant="solid" @click="childRef.submitCourse()">
					{{ __('Save') }}
				</Button>
			</div>
		</header>
		<div>
			<BatchOverview v-if="!isAdmin && !isStudent" :batch="batch" />
			<div v-else>
				<Tabs :tabs="tabs" v-model="tabIndex">
					<template #tab-panel="{ tab }">
						<component :is="tab.component" :batch="batch" ref="childRef" />
					</template>
				</Tabs>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Laptop,
	List,
	Mail,
	MessageCircle,
	Settings2,
	Trash2,
	TrendingUp,
} from 'lucide-vue-next'
import { computed, inject, markRaw, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	Badge,
	Breadcrumbs,
	Button,
	createResource,
	Tabs,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import AdminBatchDashboard from '@/pages/Batches/components/AdminBatchDashboard.vue'
import StudentBatchDashboard from '@/pages/Batches/components/BatchDashboard.vue'
import BatchOverview from '@/pages/Batches/BatchOverview.vue'
import LiveClass from '@/pages/Batches/components/LiveClass.vue'
import Announcements from '@/pages/Batches/components/Annoucements.vue'
import BatchForm from '@/pages/Batches/BatchForm.vue'
import Discussions from '@/components/Discussions.vue'

const router = useRouter()
const route = useRoute()
const { brand } = sessionStore()
const user = inject('$user')
const childRef = ref(null)
const tabIndex = ref(0)
const tabs = ref([])

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const updateTabIndex = () => {
	const hash = route.hash
	if (hash) {
		tabs.value.forEach((tab, index) => {
			if (tab.label?.toLowerCase() === hash.replace('#', '')) {
				tabIndex.value = index
			}
		})
	}
}

watch(tabIndex, () => {
	const tab = tabs.value[tabIndex.value]
	if (tab.label != route.hash.replace('#', '')) {
		router.push({ ...route, hash: `#${tab.label.toLowerCase()}` })
	}
})

const batch = createResource({
	url: 'lms.lms.utils.get_batch_details',
	cache: ['batch', props.batchName],
	params: {
		batch: props.batchName,
	},
	auto: true,
	onSuccess: (data) => {
		if (!data) {
			router.push({ name: 'Batches' })
		}
	},
})

watch(batch, () => {
	updateTabs()
	updateTabIndex()
})

const updateTabs = () => {
	addToTabs('Overview', markRaw(BatchOverview), List)
	if (!user.data) return
	if (isAdmin.value) {
		addToTabs('Dashboard', markRaw(AdminBatchDashboard), TrendingUp)
	} else if (isStudent.value) {
		addToTabs('Dashboard', markRaw(StudentBatchDashboard), null)
	}
	addToTabs('Classes', markRaw(LiveClass), Laptop)
	addToTabs('Announcements', markRaw(Announcements), Mail)
	addToTabs('Discussions', markRaw(Discussions), MessageCircle)
	if (isAdmin.value) {
		addToTabs('Settings', markRaw(BatchForm), Settings2)
	}
}

const addToTabs = (label, component, icon) => {
	if (!tabs.value.some((tab) => tab.label === label)) {
		tabs.value.push({
			label,
			component,
			icon,
		})
	}
}

const isAdmin = computed(() => {
	return user.data?.is_moderator || batch.data?.is_evaluator
})

const isStudent = computed(() => {
	return batch.data?.students?.includes(user.data?.name)
})

const breadcrumbs = computed(() => {
	let crumbs = [{ label: __('Batches'), route: { name: 'Batches' } }]
	crumbs.push({
		label: batch?.data?.title,
		route: { name: 'BatchDetail', params: { batchName: batch?.data?.name } },
	})
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
	color: theme('colors.gray.900') !important;
}
</style>
