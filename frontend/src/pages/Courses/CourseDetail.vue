<template>
	<div v-if="course.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
			<div v-if="tabIndex == 2 && isAdmin" class="flex items-center gap-x-2">
				<Badge v-if="childRef?.isDirty" theme="orange">
					{{ __('Not Saved') }}
				</Badge>
				<Dropdown :options="courseMenu" side="left">
					<template v-slot="{ open }">
						<Button>
							<template #icon>
								<Ellipsis class="w-4 h-4 stroke-1.5" />
							</template>
						</Button>
					</template>
				</Dropdown>
				<Button variant="solid" @click="childRef.submitCourse()">
					{{ __('Save') }}
				</Button>
			</div>
		</header>
		<CourseOverview v-if="!isAdmin" :course="course" />
		<div v-else>
			<Tabs :tabs="tabs" v-model="tabIndex">
				<template #tab-panel="{ tab }">
					<component :is="tab.component" :course="course" ref="childRef" />
				</template>
			</Tabs>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Breadcrumbs,
	Button,
	call,
	createResource,
	Dropdown,
	Tabs,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, markRaw, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { useRouter, useRoute } from 'vue-router'
import {
	Download,
	Ellipsis,
	List,
	Settings2,
	Trash2,
	TrendingUp,
} from 'lucide-vue-next'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'

const { brand } = sessionStore()
const router = useRouter()
const route = useRoute()
const user = inject('$user')
const tabIndex = ref(0)
const childRef = ref(null)

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	updateTabIndex()
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

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
})

const tabs = ref([
	{
		label: __('Overview'),
		component: markRaw(CourseOverview),
		icon: List,
	},
	{
		label: __('Dashboard'),
		component: markRaw(CourseDashboard),
		icon: TrendingUp,
	},
	{
		label: __('Settings'),
		component: markRaw(CourseForm),
		icon: Settings2,
	},
])

watch(
	() => props.courseName,
	() => {
		course.reload()
	}
)

watch(course, () => {
	if (!isAdmin.value && !course.data?.published && !course.data?.upcoming) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = () => {
	let user_is_instructor = false
	course.data?.instructors.forEach((instructor) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const isAdmin = computed(() => {
	return user.data?.is_moderator || isInstructor()
})

const exportCourse = async () => {
	try {
		const response = await fetch(
			'/api/method/lms.lms.api.export_course_as_zip?course_name=' +
				course.data.name,
			{
				method: 'GET',
				credentials: 'include',
			}
		)

		if (!response.ok) {
			const errorText = await response.text()
			console.error('Error response:', errorText)
			throw new Error('Download failed')
		}

		const blob = await response.blob()
		const disposition = response.headers.get('Content-Disposition')
		let filename = 'course.zip'
		if (disposition && disposition.includes('filename=')) {
			filename = disposition.split('filename=')[1].replace(/"/g, '')
		}

		const url = window.URL.createObjectURL(blob)

		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()

		a.remove()
		window.URL.revokeObjectURL(url)
	} catch (err) {
		console.error(err)
		toast.error('Export failed')
	}
}

const download_course_zip = (data) => {
	const a = document.createElement('a')
	a.href = data.export_url
	a.download = data.name
	a.click()
}

const courseMenu = computed(() => {
	let options = [
		{
			label: __('Export'),
			onClick() {
				exportCourse()
			},
			icon: Download,
		},
		{
			label: __('Delete'),
			onClick() {
				childRef.value.trashCourse()
			},
			icon: Trash2,
		},
	]
	return options
})

const breadcrumbs = computed(() => {
	let crumbs = [{ label: __('Courses'), route: { name: 'Courses' } }]
	crumbs.push({
		label: course?.data?.title,
		route: { name: 'CourseDetail', params: { courseName: course?.data?.name } },
	})
	return crumbs
})

usePageMeta(() => {
	return {
		title: course?.data?.title,
		icon: brand.favicon,
	}
})
</script>
<style>
.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}
</style>
