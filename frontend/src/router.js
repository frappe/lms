import { createRouter, createWebHistory } from 'vue-router'
import { usersStore } from './stores/user'
import { sessionStore } from './stores/session'
import { useSettings } from './stores/settings'

let defaultRoute = '/courses'
const routes = [
	{
		path: '/',
		redirect: {
			name: 'Courses',
		},
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
		path: '/courses/:courseName/learn/:chapterNumber-:lessonNumber',
		name: 'Lesson',
		component: () => import('@/pages/Lesson.vue'),
		props: true,
	},
	{
		path: '/courses/:courseName/certification',
		name: 'CourseCertification',
		component: () => import('@/pages/CourseCertification.vue'),
		props: true,
	},
	{
		path: '/courses/:courseName/learn/:chapterName',
		name: 'SCORMChapter',
		component: () => import('@/pages/SCORMChapter.vue'),
		props: true,
	},
	{
		path: '/batches',
		name: 'Batches',
		component: () => import('@/pages/Batches.vue'),
	},
	{
		path: '/batches/details/:batchName',
		name: 'BatchDetail',
		component: () => import('@/pages/BatchDetail.vue'),
		props: true,
	},
	{
		path: '/batches/:batchName',
		name: 'Batch',
		component: () => import('@/pages/Batch.vue'),
		props: true,
	},
	{
		path: '/billing/:type/:name',
		name: 'Billing',
		component: () => import('@/pages/Billing.vue'),
		props: true,
	},
	{
		path: '/statistics',
		name: 'Statistics',
		component: () => import('@/pages/Statistics.vue'),
	},
	{
		path: '/user/:username',
		name: 'Profile',
		component: () => import('@/pages/Profile.vue'),
		props: true,
		redirect: { name: 'ProfileAbout' },
		children: [
			{
				name: 'ProfileAbout',
				path: '',
				component: () => import('@/pages/ProfileAbout.vue'),
			},
			{
				name: 'ProfileCertificates',
				path: 'certificates',
				component: () => import('@/pages/ProfileCertificates.vue'),
			},
			{
				name: 'ProfileRoles',
				path: 'roles',
				component: () => import('@/pages/ProfileRoles.vue'),
			},
			{
				name: 'ProfileEvaluator',
				path: 'slots',
				component: () => import('@/pages/ProfileEvaluator.vue'),
			},
			{
				name: 'ProfileEvaluationSchedule',
				path: 'schedule',
				component: () =>
					import('@/pages/ProfileEvaluationSchedule.vue'),
			},
		],
	},
	{
		path: '/job-openings',
		name: 'Jobs',
		component: () => import('@/pages/Jobs.vue'),
	},
	{
		path: '/job-openings/:job',
		name: 'JobDetail',
		component: () => import('@/pages/JobDetail.vue'),
		props: true,
	},
	{
		path: '/courses/:courseName/edit',
		name: 'CourseForm',
		component: () => import('@/pages/CourseForm.vue'),
		props: true,
	},
	{
		path: '/courses/:courseName/learn/:chapterNumber-:lessonNumber/edit',
		name: 'LessonForm',
		component: () => import('@/pages/LessonForm.vue'),
		props: true,
	},
	{
		path: '/batches/:batchName/edit',
		name: 'BatchForm',
		component: () => import('@/pages/BatchForm.vue'),
		props: true,
	},
	{
		path: '/job-opening/:jobName/edit',
		name: 'JobCreation',
		component: () => import('@/pages/JobCreation.vue'),
		props: true,
	},
	{
		path: '/certified-participants',
		name: 'CertifiedParticipants',
		component: () => import('@/pages/CertifiedParticipants.vue'),
	},
	{
		path: '/notifications',
		name: 'Notifications',
		component: () => import('@/pages/Notifications.vue'),
	},
	{
		path: '/badges/:badgeName/:email',
		name: 'Badge',
		component: () => import('@/pages/Badge.vue'),
		props: true,
	},
	{
		path: '/quizzes',
		name: 'Quizzes',
		component: () => import('@/pages/Quizzes.vue'),
	},
	{
		path: '/quizzes/:quizID',
		name: 'QuizForm',
		component: () => import('@/pages/QuizForm.vue'),
		props: true,
	},
	{
		path: '/quiz/:quizID',
		name: 'QuizPage',
		component: () => import('@/pages/QuizPage.vue'),
		props: true,
	},
	{
		path: '/quiz-submissions/:quizID',
		name: 'QuizSubmissionList',
		component: () => import('@/pages/QuizSubmissionList.vue'),
		props: true,
	},
	{
		path: '/quiz-submission/:submission',
		name: 'QuizSubmission',
		component: () => import('@/pages/QuizSubmission.vue'),
		props: true,
	},
	{
		path: '/programs/:programName',
		name: 'ProgramForm',
		component: () => import('@/pages/ProgramForm.vue'),
		props: true,
	},
	{
		path: '/programs',
		name: 'Programs',
		component: () => import('@/pages/Programs.vue'),
	},
	{
		path: '/assignments',
		name: 'Assignments',
		component: () => import('@/pages/Assignments.vue'),
	},
	{
		path: '/assignments/:assignmentID',
		name: 'AssignmentForm',
		component: () => import('@/pages/AssignmentForm.vue'),
		props: true,
	},
	{
		path: '/assignment-submission/:assignmentID/:submissionName',
		name: 'AssignmentSubmission',
		component: () => import('@/pages/AssignmentSubmission.vue'),
		props: true,
	},
	{
		path: '/assignment-submissions',
		name: 'AssignmentSubmissionList',
		component: () => import('@/pages/AssignmentSubmissionList.vue'),
	},
]

let router = createRouter({
	history: createWebHistory('/lms'),
	routes,
})

router.beforeEach(async (to, from, next) => {
	const { userResource } = usersStore()
	let { isLoggedIn } = sessionStore()
	const { allowGuestAccess } = useSettings()

	try {
		if (isLoggedIn) {
			await userResource.promise
		}
	} catch (error) {
		isLoggedIn = false
	}

	if (!isLoggedIn) {
		await allowGuestAccess.promise
		if (!allowGuestAccess.data) {
			window.location.href = '/login'
			return
		}
	}
	return next()
})

export default router
