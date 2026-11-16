// Closing the continue-your-course panel hides it until the next sign-in.
// sessionStorage ends with the tab, which keeps a draft left for days coming
// back, but it also outlives a sign-out in that tab, so the sign-out drops the
// flag itself.
const PREFIX = 'continueCoursePanelClosed:'

export const continuePanelClosedKey = (user: string) => PREFIX + user

export function forgetContinuePanelClosed() {
	try {
		for (const key of Object.keys(sessionStorage)) {
			if (key.startsWith(PREFIX)) sessionStorage.removeItem(key)
		}
	} catch {
		/* no storage, nothing to forget */
	}
}
