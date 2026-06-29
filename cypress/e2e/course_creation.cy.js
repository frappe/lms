describe("Course Creation", () => {
	const courseTitle = "Test Course";
	const courseSlug = "test-course";

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

	it("adds a chapter and a lesson", () => {
		cy.login();
		cy.intercept(
			"POST",
			"**/api/method/lms.lms.utils.get_course_outline"
		).as("outline");
		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();
		cy.get("button, [role=tab]").contains("Course editor").click();
		cy.closeOnboardingModal();
		cy.wait("@outline", { timeout: 20000 });

		// Add a chapter via the toolbar "Add" button (CourseEditor hides
		// CourseOutline's own header). Scope to the chapter dialog by its Title field
		// — the onboarding "Getting started" panel is also a dismissable layer, but it
		// has no Title input.
		cy.contains("button", "Add").click();
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
		cy.contains("Test Chapter", { timeout: 15000 }).should("exist");

		// The onboarding help modal re-expands when the chapter step completes —
		// dismiss it before adding a lesson so it can't hijack the editor.
		cy.closeOnboardingModal();

		// "Add Lesson" creates an "Untitled lesson" and opens it in the editor with
		// the title field focused (LessonForm focuses the title — not the block
		// editor — for a new, empty lesson, so our keystrokes land in the title).
		// Rename it inline; the debounced autosave persists via frappe.client.set_value.
		cy.intercept("POST", "**/api/method/frappe.client.set_value").as(
			"renameLesson"
		);
		cy.button("Add Lesson", { timeout: 10000 }).click();
		cy.get("textarea.lesson-title", { timeout: 15000 })
			.should("have.value", "Untitled lesson")
			.clear()
			.should("have.value", "")
			.type("Test Lesson")
			.should("have.value", "Test Lesson");
		cy.wait("@renameLesson", { timeout: 15000 });
		cy.contains(".outline-lesson", "Test Lesson", {
			timeout: 15000,
		}).should("exist");

		// Regression: deleting the lesson open in the editor must drop back to the
		// empty "choose a lesson" state. Add a throwaway lesson, delete it (the last
		// row, just added), and assert the editor cleared and "Test Lesson" survived.
		cy.button("Add Lesson", { timeout: 10000 }).click();
		cy.get("textarea.lesson-title", { timeout: 15000 }).should(
			"have.value",
			"Untitled lesson"
		);
		cy.get(".outline-lesson")
			.last()
			.find(".lucide-trash-2")
			.click({ force: true });
		cy.contains("Delete this lesson?");
		cy.get("[data-dismissable-layer]").contains("button", "Delete").click();
		cy.contains("Lesson deleted successfully");
		cy.contains("Select a lesson on the right to start editing.").should(
			"be.visible"
		);
		cy.get(".outline-lesson").should("have.length", 1);
		cy.contains(".outline-lesson", "Test Lesson").should("exist");
	});

	it("verifies the course overview", () => {
		cy.login();
		cy.visit(`/lms/courses/${courseSlug}`);
		cy.closeOnboardingModal();

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
		// Chapter shows in the course content (the lesson was verified in the editor
		// outline in the previous test).
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
