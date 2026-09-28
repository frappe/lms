// Raven's SPA is mounted at /raven (hooks.py website_route_rules), and its
// channel route is nested under the workspace, `:workspaceID/:channelID` in
// Raven's App.tsx. There is no channel-only route, so a channel link needs the
// Raven workspace id as well as the channel id.
const RAVEN_BASE = '/raven'

export function ravenWorkspaceUrl(ravenWorkspace: string): string {
	return `${RAVEN_BASE}/${encodeURIComponent(ravenWorkspace)}`
}

export function ravenChannelUrl(
	ravenWorkspace: string,
	ravenChannel: string
): string {
	return `${ravenWorkspaceUrl(ravenWorkspace)}/${encodeURIComponent(
		ravenChannel
	)}`
}
