import { ref } from 'vue'

// Members.vue's list resource cannot carry a frappe-ui `cache` key. Its
// makeParams and onSuccess close over component-local refs (the search box, the
// role filter, the accumulated page), and createResource returns the FIRST
// instance for a cache key without ever rebinding those closures
// (frappe-ui/src/resources/resources.js:9-21). A remounted panel would get a
// resource still writing into the unmounted one's refs, and render empty
// forever.
//
// So the member forms announce a change here instead of reaching for the
// parent's resource. A counter rather than a boolean: two saves in a row are
// two distinct values, where a flag would need resetting and could be missed.
export const membersRevision = ref(0)

export const notifyMembersChanged = (): void => {
	membersRevision.value += 1
}
