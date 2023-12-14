import { createRouter, createWebHistory } from 'vue-router'
import { usersStore } from './stores/user'
import { sessionStore } from './stores/session'

const routes = [
	{
		path: '/',
		name: 'Home',
		component: () => import('@/pages/Home.vue'),
	},
	{
		path: '/courses',
		name: 'Courses',
		component: () => import('@/pages/Courses.vue'),
	},
	{
		path: '/courses/:courseName',
		name: 'CourseDetail',
		component: () => import('@/pages/CourseDetail.vue'),
		props: true,
	},
	{
		// Create a route for path /courses/inventory-management/learn/1.1
		path: '/courses/:courseName/learn/:lessonNumber',
		name: 'Lesson',
		component: () => import('@/pages/Lesson.vue'),
		props: {},
	},
	{
		path: '/batches',
		name: 'Batches',
		component: () => import('@/pages/Batches.vue'),
	},
]

let router = createRouter({
	history: createWebHistory('/'),
	routes,
})

router.beforeEach(async (to, from, next) => {
	const { userResource } = usersStore()
	let { isLoggedIn } = sessionStore()

	try {
		if (isLoggedIn) {
			await userResource.reload()
		}
	} catch (error) {
		isLoggedIn = false
	}
	return next()
})

export default router