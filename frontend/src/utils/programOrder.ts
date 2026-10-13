type ProgramCourse = { idx?: number }

export function reindexProgramCourses(courses: ProgramCourse[]): void {
	courses.forEach((course, index) => {
		course.idx = index + 1
	})
}
