/** The login page URL that returns the visitor to `target`, the current page by default. */
export const loginUrl = (
	target: string = window.location.pathname + window.location.search
): string => `/login?redirect-to=${encodeURIComponent(target)}`

/** Sends the visitor to log in and back to `target`, the current page by default. */
export const redirectToLogin = (target?: string): void => {
	window.location.href = loginUrl(target)
}
