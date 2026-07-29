/* Moves focus to the skip-link target without a native fragment navigation,
   which would overwrite the hash that pages like CourseDetail use for tab
   state. The target carries tabindex="-1" so it can take focus. */
export function skipToContent(id: string) {
	document.getElementById(id)?.focus()
}
