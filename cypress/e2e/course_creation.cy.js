describe("Course Creation", () => {
	const courseTitle = "Test Course";
	const courseSlug = "test-course";

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

		// Add a chapter. In the editor the chapter button is the "Add" button in
		// the CourseDetail toolbar (CourseEditor hides CourseOutline's own
		// header), present whenever the editor is in edit mode — unlike the
		// load-dependent "Create chapter" empty-state button.
		cy.contains("button", "Add", { timeout: 20000 }).click();
		cy.get("[data-dismissable-layer]")
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
		// dismiss it before adding a lesson so it can't hijack the lesson modal.
		cy.closeOnboardingModal();

		// Create lesson. LessonModal's Create lives in a #actions slot (rendered
		// outside the dialog's dismissable layer), but its Title submits on Enter —
		// so type + Enter rather than clicking Create.
		cy.button("Add Lesson", { timeout: 10000 }).click();
		cy.get("[data-dismissable-layer]")
			.should("be.visible")
			.within(() => {
				// .clear() first: the field can carry over the previous title.
				cy.get("label")
					.contains("Title")
					.parent()
					.find("input")
					.clear()
					.type("Test Lesson{enter}");
			});

		// Verify the lesson landed in the editor outline. (The public overview
		// collapses chapters, so the lesson title isn't asserted there.)
		cy.contains("Test Lesson", { timeout: 15000 }).should("exist");

		// Navigate to course overview
		cy.visit("/lms/courses");
		cy.closeOnboardingModal();
		cy.contains("a", courseTitle).click();

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
