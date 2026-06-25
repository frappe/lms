describe("Course Creation", () => {
	const courseTitle = "Test Course";
	const courseSlug = "test-course";

	// Start from a clean slate so leftover chapters/lessons from an earlier
	// (possibly failed) run don't accumulate duplicate "Untitled lesson" rows in
	// the outline and break the rename/delete assertions. Best-effort: the course
	// may not exist yet, and a link-protected delete is ignored.
	before(() => {
		cy.login();
		cy.request({
			url: "/api/method/frappe.client.delete",
			method: "POST",
			body: { doctype: "LMS Course", name: courseSlug },
			failOnStatusCode: false,
		});
	});

	it("creates a new course with settings", () => {
		cy.login();
		cy.visit("/lms/courses");
		cy.closeOnboardingModal();

		// Open New Course modal
		cy.get("button").contains("Create").click();
		cy.contains('[role="menuitem"]', "New Course").click();

		cy.get("[data-dismissable-layer]")
			.last()
			.should("be.visible")
			.within(() => {
				cy.get("label")
					.contains("Title")
					.parent()
					.find("input")
					.type(courseTitle);

				// Instructors — MultiSelect
				cy.get("label")
					.contains("Instructors")
					.parent()
					.find("button")
					.first()
					.click();
			});

		cy.get('[data-slot="content-body"] [data-slot="input"]')
			.should("be.visible")
			.type("frappe");
		cy.get('[data-slot="content-body"] [role="option"]', { timeout: 10000 })
			.first()
			.click();
		cy.get("body").type("{esc}");

		cy.get("[data-dismissable-layer]")
			.last()
			.should("be.visible")
			.within(() => {
				// Thumbnail
				cy.get('input[type="file"]').attachFile("profile.png", {
					force: true,
				});

				// Short introduction
				cy.get("label")
					.contains("Short introduction")
					.parent()
					.find("textarea")
					.type("Test Course Short Introduction to test the UI");

				// Description
				cy.get("div.ProseMirror").invoke(
					"text",
					"Test Course Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
				);

				cy.button("Save").click();
			});

		// Redirect to course settings
		cy.url({ timeout: 10000 }).should(
			"include",
			`/lms/courses/${courseSlug}`
		);
		cy.closeOnboardingModal();

		// Configure settings
		cy.get("button, [role=tab]").contains("Settings").click();

		// Preview video — the redesigned field has a URL input (plus a hidden
		// file input), so target the YouTube URL input by its placeholder.
		cy.get("label")
			.contains("Preview video")
			.parent()
			.find('input[placeholder="Paste a YouTube link"]')
			.type("https://www.youtube.com/embed/-LPmw2Znl2c");

		// Tags
		cy.get("label")
			.contains("Tags")
			.parent()
			.find("button")
			.first()
			.click();
		const tagInput = '[data-slot="content-body"] [data-slot="input"]';
		cy.get(tagInput).should("be.visible").type("Learning{enter}");
		cy.get(tagInput).clear().type("Frappe{enter}");
		cy.get(tagInput).clear().type("ERPNext{enter}");
		cy.get("body").type("{esc}");

		cy.button("Save").click();

		// Publish
		cy.get("header")
			.find("button")
			.contains(/^Publish$/)
			.click();
		cy.contains(/Course published/i, { timeout: 10000 }).should("exist");

		// Reload and verify published state
		cy.reload();
		cy.closeOnboardingModal();
		cy.get("header")
			.contains(/^Published$/, { timeout: 10000 })
			.should("exist");
		cy.get("header")
			.find("button")
			.contains(/^Unpublish$/)
			.should("exist");
	});

	it("adds chapter and lesson, then verifies course outline", () => {
		cy.login();

		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();

		// Open Course editor tab
		cy.get("button, [role=tab]").contains("Course editor").click();

		// The onboarding help modal re-appears after the first course is created
		// (its "create_first_course" step completes) and covers the editor
		// toolbar — dismiss it again before adding a chapter.
		cy.closeOnboardingModal();

		// The chapter "Add" button in the CourseDetail toolbar appears as soon as
		// the editor enters edit mode, but it delegates to CourseOutline
		// (openChapterModal), which isn't mounted until the outline resource
		// resolves. Clicking "Add" during the loading skeleton silently no-ops, so
		// first wait for the loaded outline — the "No chapters yet" empty state is
		// rendered by CourseOutline itself, so its visibility proves the component
		// (and its chapter modal) is mounted.
		cy.contains("No chapters yet", { timeout: 20000 }).should("be.visible");

		// Add a chapter via the toolbar "Add" button (CourseEditor hides
		// CourseOutline's own header).
		cy.contains("button", "Add").click();
		// Scope to the chapter dialog by its Title field — the onboarding "Getting
		// started" panel is also a dismissable layer, but it has no Title input.
		cy.get("[data-dismissable-layer]")
			.filter(':has(label:contains("Title"))')
			.should("be.visible")
			.within(() => {
				cy.get("label")
					.contains("Title")
					.parent()
					.find("input")
					.type("Test Chapter");
				cy.button("Create").click();
			});

		// Wait for the chapter to land in the outline (more robust than waiting on
		// the network call) before adding a lesson.
		cy.contains("Test Chapter", { timeout: 15000 }).should("exist");

		// The onboarding help modal re-expands when the chapter step completes —
		// dismiss it before adding a lesson so it can't hijack the editor.
		cy.closeOnboardingModal();

		// Create lesson. "Add Lesson" creates an "Untitled lesson" and opens it in
		// the editor; the title is edited inline on the lesson itself and the
		// debounced autosave persists it (no modal).
		cy.button("Add Lesson", { timeout: 10000 }).click();
		// "Add Lesson" prefills the title with "Untitled lesson", so clear it by
		// selecting all + backspace (a plain .clear() doesn't reliably overwrite
		// the prefilled default) before typing the real title.
		cy.get("textarea.lesson-title", { timeout: 15000 })
			.should("have.value", "Untitled lesson")
			.type("{selectall}{backspace}")
			.type("Test Lesson");

		// The title edit arms a debounced autosave; once it persists, CourseEditor
		// reflects the new title in the shared outline. Assert against the outline
		// row specifically (deterministic via Cypress retry) so the later delete
		// targets the throwaway "Untitled lesson", not this renamed one.
		cy.contains(".outline-lesson", "Test Lesson", {
			timeout: 15000,
		}).should("exist");

		// Regression: deleting the lesson that's open in the editor must drop back
		// to the empty "choose a lesson" state, not keep showing the deleted
		// lesson. Add a throwaway lesson (it opens in the editor), delete it, and
		// assert the editor cleared. "Test Lesson" stays for the overview below.
		cy.button("Add Lesson", { timeout: 10000 }).click();
		cy.get("textarea.lesson-title", { timeout: 15000 }).should(
			"have.value",
			"Untitled lesson"
		);
		cy.contains(".outline-lesson", "Untitled lesson")
			.find(".lucide-trash-2")
			.click({ force: true });
		cy.contains("Delete this lesson?");
		cy.get("[data-dismissable-layer]").contains("button", "Delete").click();
		cy.contains("Lesson deleted successfully");
		cy.contains("Select a lesson on the right to start editing.").should(
			"be.visible"
		);
		cy.contains(".outline-lesson", "Untitled lesson").should("not.exist");

		// Navigate to course overview. Visit the detail page directly (same as the
		// delete test) rather than clicking through the course list — the list's
		// tab/filter rendering is a separate concern and made this flaky.
		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();

		// Verify overview content
		cy.url({ timeout: 10000 }).should(
			"include",
			`/lms/courses/${courseSlug}`
		);
		cy.contains(courseTitle);
		cy.contains("Test Course Short Introduction to test the UI");
		cy.contains("Learning");
		cy.get("iframe").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/-LPmw2Znl2c"
		);

		// Chapter shows in the course content (the lesson was already verified in
		// the editor outline above).
		cy.contains("Test Chapter", { timeout: 15000 }).should("exist");
	});

	it("deletes the course", () => {
		cy.login();
		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();

		cy.get("button, [role=tab]").contains("Settings").click();

		cy.get("header")
			.find('button[aria-haspopup="menu"]', { timeout: 10000 })
			.first()
			.click({ force: true });
		cy.get("div[role=menu]").within(() => {
			cy.contains('[role="menuitem"]', "Delete").click();
		});
		cy.get("span").contains("Delete").click();

		cy.url({ timeout: 10000 }).should("include", "/lms/courses");
		cy.contains(courseTitle).should("not.exist");
	});
});
