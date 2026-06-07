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

		// Embed video
		cy.get("label")
			.contains("Embed (preview video)")
			.parent()
			.find("input")
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

		// Wait on the chapter write (batch_creation pattern) so we don't add a
		// lesson before the Course Chapter + Chapter Reference are persisted.
		cy.intercept("POST", "**/lms.lms.api.upsert_chapter").as(
			"upsertChapter"
		);

		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();

		// Open Course editor tab
		cy.get("button, [role=tab]").contains("Course editor").click();

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

		// Wait for the chapter write to complete before adding a lesson.
		cy.wait("@upsertChapter", { timeout: 15000 });

		// Create lesson
		cy.button("Add Lesson", { timeout: 10000 }).click();
		cy.get("[data-dismissable-layer]")
			.should("be.visible")
			.within(() => {
				cy.get("label")
					.contains("Title")
					.parent()
					.find("input")
					.type("Test Lesson");
				cy.button("Create").click();
			});

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

		// Chapter and lesson in course content
		cy.contains("Test Chapter", { timeout: 15000 }).should("exist");
		cy.contains("Test Lesson", { timeout: 15000 }).should("exist");
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
