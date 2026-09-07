// The route table lives in its own module, separate from router.js, so it can
// be imported without pulling in frappe-ui or the pinia stores that router.js
// wires up around it (the beforeEach guard, the persona check). That keeps
// tests able to assert against the REAL route table via `createRouter` with a
// memory history, rather than a copy that could drift from what router.js
// actually registers.
export const routes = [
	{
		path: '/',
		name: 'Home',
		component: () => import('@/pages/Home/Home.vue'),
	},
	{
		path: '/courses',
		name: 'Courses',
		component: () => import('@/pages/Courses/Courses.vue'),
		// Both children are static segments, so vue-router scores them above
		// the sibling '/courses/:courseName' and they win. The trade: a course
		// whose docname is literally `new` or `import` becomes unreachable.
		// Accepted and documented in the design — it is the same trade the app
		// already makes for '/batches/details/:batchName'. Deliberately not
		// guarded.
		children: [
			{
				path: 'new',
				name: 'NewCourse',
				component: () => import('@/pages/Forms/NewCourseForm.vue'),
			},
			{
				path: 'import',
				name: 'CourseImport',
				component: () => import('@/pages/Forms/CourseImportForm.vue'),
			},
		],
	},
	{
		path: '/courses/:courseName',
		name: 'CourseDetail',
		component: () => import('@/pages/Courses/CourseDetail.vue'),
		props: true,
		children: [
			{
				path: 'chapter/:chapterName',
				name: 'ChapterForm',
				component: () => import('@/pages/Forms/ChapterForm.vue'),
				props: true,
			},
			{
				path: 'enrollment/new',
				name: 'NewCourseEnrollment',
				component: () =>
					import('@/pages/Forms/CourseEnrollmentForm.vue'),
				props: true,
			},
		],
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
		component: () => import('@/pages/Courses/CourseCertification.vue'),
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
		component: () => import('@/pages/Batches/Batches.vue'),
		children: [
			{
				path: 'new',
				name: 'NewBatch',
				component: () => import('@/pages/Forms/NewBatchForm.vue'),
			},
		],
	},
	{
		path: '/batches/details/:batchName',
		redirect: (to) => `/batches/${to.params.batchName}`,
	},
	{
		path: '/batches/:batchName',
		name: 'BatchDetail',
		component: () => import('@/pages/Batches/BatchDetail.vue'),
		props: true,
		children: [
			{
				path: 'certificates',
				name: 'BulkCertificates',
				component: () =>
					import('@/pages/Forms/BulkCertificatesForm.vue'),
				props: true,
			},
			// `new` is hard-coded rather than a :param (design doc Q3): neither
			// form has an edit mode, so `new` is the only value the param could
			// ever take.
			{
				path: 'live-class/new',
				name: 'NewLiveClass',
				component: () => import('@/pages/Forms/LiveClassForm.vue'),
				props: true,
			},
			{
				path: 'announcement/new',
				name: 'NewAnnouncement',
				component: () => import('@/pages/Forms/AnnouncementForm.vue'),
				props: true,
			},
			{
				path: 'course/new',
				name: 'NewBatchCourse',
				component: () => import('@/pages/Forms/BatchCourseForm.vue'),
				props: true,
			},
			{
				path: 'assessment/new',
				name: 'NewAssessment',
				component: () => import('@/pages/Forms/AssessmentForm.vue'),
				props: true,
			},
			{
				path: 'student/new',
				name: 'NewBatchStudent',
				component: () => import('@/pages/Forms/BatchStudentForm.vue'),
				props: true,
			},
			{
				path: 'email-template/new',
				name: 'NewBatchEmailTemplate',
				component: () => import('@/pages/Forms/EmailTemplateForm.vue'),
				props: true,
			},
		],
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
			{
				name: 'ProfileEditForm',
				path: 'edit',
				component: () => import('@/pages/Forms/ProfileEditForm.vue'),
				props: true,
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
		path: '/job-openings/:job/applications',
		name: 'JobApplications',
		component: () => import('@/pages/JobApplications.vue'),
		props: true,
	},
	{
		path: '/job-opening/:jobName/edit',
		name: 'JobForm',
		component: () => import('@/pages/Forms/JobForm.vue'),
		props: true,
	},
	{
		path: '/certified-participants',
		name: 'CertifiedParticipants',
		component: () => import('@/pages/CertifiedParticipants.vue'),
	},
	{
		path: '/quizzes',
		name: 'Quizzes',
		component: () => import('@/pages/Quizzes.vue'),
	},
	{
		path: '/quizzes/:quizID',
		name: 'QuizForm',
		component: () => import('@/pages/Forms/QuizForm.vue'),
		props: true,
		children: [
			{
				// :questionName is the LMS Quiz Question ROW name, or 'new'. It is
				// NOT the LMS Question docname — marks lives on the row. See design R2.
				path: 'question/:questionName',
				name: 'QuizQuestion',
				component: () => import('@/pages/Forms/QuizQuestionForm.vue'),
				props: true,
			},
		],
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
		path: '/programs',
		name: 'Programs',
		component: () => import('@/pages/Programs/Programs.vue'),
		children: [
			{
				// `/edit` is mandatory, not stylistic. A bare `:programName` child
				// would produce a path byte-identical to the sibling ProgramDetail
				// route below with the same match score; vue-router keeps both and
				// serves whichever was registered first — this one — which would
				// silently break every student-facing program link.
				path: ':programName/edit',
				name: 'ProgramForm',
				component: () => import('@/pages/Forms/ProgramForm.vue'),
				props: true,
			},
			{
				// Nested for the same reason `/edit` is, plus one of its own: the
				// student list keeps its selected tab in a local ref, and staying a
				// child is what keeps that list mounted so cancelling lands back on
				// the tab the student opened this from.
				path: ':programName/enroll',
				name: 'ProgramEnrollment',
				component: () =>
					import('@/pages/Programs/ProgramEnrollment.vue'),
				props: true,
			},
		],
	},
	{
		path: '/programs/:programName',
		name: 'ProgramDetail',
		component: () => import('@/pages/Programs/ProgramDetail.vue'),
		props: true,
	},
	{
		path: '/assignments',
		name: 'Assignments',
		component: () => import('@/pages/Assignments.vue'),
		children: [
			{
				path: ':assignmentID',
				name: 'AssignmentForm',
				component: () => import('@/pages/Forms/AssignmentForm.vue'),
				props: true,
			},
		],
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
	{
		path: '/persona',
		name: 'PersonaForm',
		component: () => import('@/pages/Forms/PersonaForm.vue'),
	},
	{
		path: '/programming-exercises',
		name: 'ProgrammingExercises',
		component: () =>
			import('@/pages/ProgrammingExercises/ProgrammingExercises.vue'),
		children: [
			{
				// The `edit/` prefix is mandatory, not stylistic: a bare
				// `:exerciseID` child would also match the sibling static
				// `/programming-exercises/submissions` below, and vue-router
				// scores the child higher than a later-registered static route
				// only by accident of ordering. `edit/` keeps the two apart.
				path: 'edit/:exerciseID',
				name: 'ProgrammingExerciseForm',
				component: () =>
					import('@/pages/Forms/ProgrammingExerciseForm.vue'),
				props: true,
			},
		],
	},
	{
		path: '/programming-exercises/submissions',
		name: 'ProgrammingExerciseSubmissions',
		component: () =>
			import(
				'@/pages/ProgrammingExercises/ProgrammingExerciseSubmissions.vue'
			),
		props: true,
	},
	{
		path: '/programming-exercises/:exerciseID/submission/:submissionID',
		name: 'ProgrammingExerciseSubmission',
		component: () =>
			import(
				'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'
			),
		props: true,
	},
	{
		path: '/data-import',
		name: 'DataImportList',
		component: () => import('@/pages/DataImport.vue'),
	},
	{
		path: '/data-import/doctype/:doctype',
		name: 'NewDataImport',
		component: () => import('@/pages/DataImport.vue'),
		props: true,
	},
	{
		path: '/data-import/:importName',
		name: 'DataImport',
		component: () => import('@/pages/DataImport.vue'),
		props: true,
	},
	// The You tab. Only the phone layout offers it — the desk sidebar already
	// shows everything on it — but it is an ordinary route, so it answers a cold
	// deep link with no bar mounted the same way it answers a tap.
	{
		path: '/you',
		name: 'MobileYou',
		component: () => import('@/pages/MobileYou.vue'),
	},
	// The only thing under '/settings' with an address. Settings itself is the
	// desktop dialog, which floats over whatever page the URL points at and has
	// no route of its own — an LMS is not configured with a thumb, so there are
	// no phone settings pages for this to sit beside any more.
	//
	// The path is kept because it reads correctly and Members.vue opens the form
	// by NAME, not by path, so nothing depends on the prefix resolving;
	// '/settings' and '/settings/:item' now fall through to NotFound.
	{
		path: '/settings/users/:memberID',
		name: 'MemberForm',
		component: () => import('@/pages/Forms/MemberForm.vue'),
		props: true,
	},
	{
		path: '/:pathMatch(.*)*',
		name: 'NotFound',
		component: () => import('@/pages/NotFound.vue'),
	},
]
