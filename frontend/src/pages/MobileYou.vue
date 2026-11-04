<template>
	<MobilePageLayout :title="__('You')" :show-header="false" grouped>
		<div
			v-if="!isSignedIn"
			class="flex flex-col items-start gap-3 pt-4"
			data-testid="you-signed-out"
		>
			<p class="text-p-base text-ink-gray-6">{{ signedOutPrompt }}</p>
			<a
				href="/login"
				class="text-p-base font-medium text-ink-gray-9 underline underline-offset-2"
			>
				{{ logInLabel }}
			</a>
		</div>

		<template v-else>
			<div
				v-if="user?.full_name"
				data-testid="you-profile"
				class="flex flex-col items-center pt-4 text-center"
			>
				<div
					class="flex size-24 items-center justify-center overflow-hidden rounded-full bg-surface-gray-3 text-4xl-semibold text-ink-gray-7 shadow-sm"
				>
					<img
						v-if="userImage"
						:src="safeUrl(userImage)"
						alt=""
						class="size-full object-cover"
						@error="rememberImageFailure"
					/>
					<span v-else aria-hidden="true">{{ userInitials }}</span>
				</div>
				<div class="mt-5 max-w-full truncate text-2xl-semibold text-ink-gray-9">
					{{ user.full_name }}
				</div>
				<p v-if="userHeadline" class="max-w-sm text-p-base text-ink-gray-6">
					{{ userHeadline }}
				</p>
				<router-link
					v-if="user.username"
					:to="{ name: 'Profile', params: { username: user.username } }"
					class="mt-2 inline-flex min-h-11 items-center justify-center rounded-5 px-3 text-lg-medium text-ink-gray-8 transition-colors hover:bg-surface-gray-3 active:bg-surface-gray-4"
				>
					{{ viewProfileLabel }}
				</router-link>
			</div>

			<SettingsRowList :groups="groups" @action="activate" />
		</template>

		<BottomSheet
			:model-value="showColourMode"
			:title="colourModeSheetTitle"
			@update:model-value="showColourMode = false"
		>
			<div data-testid="colour-mode-sheet" class="px-3">
				<p class="pb-2 text-p-sm leading-normal text-ink-gray-6">
					{{ colourModeSheetDescription }}
				</p>
				<SettingsRowList
					:groups="buildAppearanceRows(themePreference)"
					@action="chooseColourMode"
				/>
			</div>
		</BottomSheet>
	</MobilePageLayout>
</template>

<script setup lang="ts">
// The bar is five fixed routes with no More sheet, so every other destination
// is reachable on a phone only from here. Structure copied from Gameplan's
// MobileMoreMenu.vue; the scale is Raven's, not Gameplan's 120px/26px.
// MobilePageLayout still renders the title as an sr-only h1, the page's only
// heading, since the rows themselves are spans.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePageMeta } from 'frappe-ui'
import { storeToRefs } from 'pinia'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { safeUrl } from '@/utils/safeUrl'
import { setThemePreference, themePreference } from '@/utils/theme'
import type { ThemePreference } from '@/utils/theme'
import {
	ensureMobileNavLinks,
	otherLinks,
	sidebarLinks,
} from '@/stores/mobileNavLinks'
import {
	loadUnreadCount,
	toggleNotifications,
	unreadCount,
} from '@/stores/notifications'
import { pickPrimaryTabs } from '@/utils/mobileNav'
import MobilePageLayout from '@/components/Layouts/MobilePageLayout.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import SettingsRowList from '@/components/Settings/Mobile/SettingsRowList.vue'
import { buildYouRows } from '@/components/Settings/youRows'
import {
	buildAppearanceRows,
	COLOUR_MODE_ACTION,
	type SettingsUser,
} from '@/components/Settings/mobileSettings'

const router = useRouter()
const { logout, brand } = sessionStore()
const { isLoggedIn } = storeToRefs(sessionStore())
const { userResource } = usersStore()

const isSignedIn = computed(
	() => isLoggedIn.value || Boolean(userResource.data)
)

// `isSignedIn` goes true when the session cookie says so, before
// `get_user_info` answers, so on a cold deep link the signed-in branch renders
// with `userResource.data` still null. The block is therefore guarded on the
// name it draws, not on the branch it sits in.
const user = computed<SettingsUser | undefined>(
	() => (userResource.data as SettingsUser | null) ?? undefined
)

// Gated on the src having LOADED, not on it existing: a `user_image` pointing
// at a deleted or unreadable file still renders an <img>, and `alt=""` tells
// the browser not to paint its broken-image icon either, leaving a bare circle.
//
// The failure holds the URL rather than a boolean, so uploading a new picture
// resets it by comparison instead of needing a watcher. `getAttribute('src')`
// and not `.src`, which resolves absolute and never equals the bound value.
const failedImageSrc = ref<string | null>(null)

const rememberImageFailure = (event: Event): void => {
	failedImageSrc.value = (event.target as HTMLImageElement).getAttribute('src')
}

// Sanitised here as well as at the binding so the `v-if` agrees with it: a
// rejected scheme falls back to the initials rather than rendering an <img>
// whose src the template then drops.
const userImage = computed(() => {
	const src = safeUrl(user.value?.user_image)
	return src && src !== failedImageSrc.value ? src : undefined
})

// Not frappe-ui's Avatar: it tops out at 46px, renders `label[0]` only, and
// sizes its fallback text off the same enum, so a class-forced 96px circle
// would carry a 14px initial. `full_name` can be the email when none is set.
const userInitials = computed(() =>
	(user.value?.full_name || user.value?.name || '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join('')
		.toUpperCase()
)

// `headline`, not `bio`: LMS has both, and `bio` is long-form prose that would
// truncate into nonsense.
const userHeadline = computed(() => user.value?.headline?.trim())

// Asked of the same function MobileLayout asks, rather than restating which
// labels are on the bar: a destination that is a tab must not also be a row.
const primaryLabels = computed(() =>
	pickPrimaryTabs(sidebarLinks.value, true).map((tab) => tab.label)
)

// `hasRoute` separates a destination that is a route from one that is a URL an
// admin typed; not every sidebar link points into the SPA.
const groups = computed(() =>
	buildYouRows({
		sidebarLinks: sidebarLinks.value,
		otherLinks: otherLinks.value,
		primaryLabels: primaryLabels.value,
		themePreference: themePreference.value,
		unreadCount: unreadCount.value,
		hasRoute: (name: string) => router.hasRoute(name),
	})
)

// Asked for here, not only by MobileLayout, so a cold deep link with no bar
// mounted above still fills the Pages group. Keyed on the viewer, so arriving
// behind a layout that already loaded them costs no request.
//
// Watched on the payload rather than read once on mount: `get_user_info` is
// what says whether this viewer can assess, and on a cold deep link that answer
// lands after the page has drawn.
watch(
	() => userResource.data,
	() =>
		ensureMobileNavLinks({
			isSignedIn: isSignedIn.value,
			isModerator: Boolean(userResource.data?.is_moderator),
			isInstructor: Boolean(userResource.data?.is_instructor),
			isEvaluator: Boolean(userResource.data?.is_evaluator),
			hasUserInfo: Boolean(userResource.data),
		}),
	{ immediate: true }
)

// The count is stale the moment the panel is used from anywhere else, and this
// page is where it is read; nothing else on a phone asks for it.
onMounted(() => loadUnreadCount())

const showColourMode = ref(false)

// Called from script rather than inline in the template: a `<script setup>`
// template resolves only what the component exposes.
const colourModeSheetTitle = __('Colour mode')
const colourModeSheetDescription = __('Applies to this device only.')

// The block's one control, and why the avatar and name above it are inert: a
// single link carrying its own visible text has the accessible name "View
// profile", so nothing about the picture can leak into it. The <img> takes
// alt="" and the initials are aria-hidden — the name is stated directly
// beneath, and announcing either would read it twice.
//
// A <router-link> rather than a Button with `@click="router.push"`: a real href
// reaches the links rotor and keeps long-press and copy-link. `min-h-11` in
// place of Button's `h-10` clears the 44px tap target the rows beside it use.
//
// The named route rather than `/user/${username}`: the router encodes the
// parameter, and a username is user-supplied.
const viewProfileLabel = __('View profile')

// `px-3` is the compensation LessonForm and PageBody's filters sheet also make:
// BottomSheet's body is px-2 against a px-5 header, so a caller adds 12px to
// land on the header's 20px — which is MobilePageLayout's body inset too.

// A plain <a>, not a router link: /login is Frappe's own server-rendered page,
// outside the SPA — the same reason MobileLayout's Log in tab uses
// `window.location`.
const signedOutPrompt = __('Log in to see your account.')
const logInLabel = __('Log in')

const chooseColourMode = (mode: string): void => {
	setThemePreference(mode as ThemePreference)
	showColourMode.value = false
}

const activate = (action: string): void => {
	if (action === 'notifications') toggleNotifications()
	else if (action === COLOUR_MODE_ACTION) showColourMode.value = true
	else if (action === 'logout') logout.submit()
}

// usePageMeta writes document.title on mount and never restores it on unmount,
// so a route that sets none inherits the last one — arriving here from Home
// left the window titled "Home". The visible header used to mask that.
usePageMeta(() => ({ title: __('You'), icon: brand.favicon }))
</script>
