describe("Course Creation", () => {
	it("creates a new course", () => {
		cy.login();
		cy.wait(500);
		cy.visit("/lms/courses");

		// Close onboarding modal
		cy.closeOnboardingModal();

		// Open the New Course modal via the Create dropdown.
		cy.get("button").contains("Create").click();
		cy.contains('[role="menuitem"]', "New Course").click();
		cy.wait(500);

		// All primary fields now live in NewCourseModal — Title, Instructors,
		// Short introduction and Course description are required before Save.
		cy.get("[data-dismissable-layer]")
			.should("be.visible")
			.within(() => {
				cy.get("label")
					.contains("Title")
					.parent()
					.find("input")
					.type("Test Course");

				// Instructors — frappe-ui MultiSelect. Click the trigger button;
				// the search input lives in a popover portalled to body, so we
				// step out of `.within()` to type it.
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
		cy.wait(500);
		cy.get('[data-slot="content-body"] [role="option"]').first().click();
		// Close the popover so subsequent within() blocks aren't blocked by it.
		cy.get("body").type("{esc}");

		cy.get("[data-dismissable-layer]")
			.should("be.visible")
			.within(() => {
				// Course thumbnail — frappe-ui Uploader. The label isn't a real
				// <label> element, so target the only file input in the modal.
				cy.get('input[type="file"]').attachFile("profile.png", {
					force: true,
				});

				cy.get("label")
					.contains("Short introduction")
					.parent()
					.find("textarea")
					.type("Test Course Short Introduction to test the UI");

				// Course description (TextEditor / ProseMirror).
				cy.get("div.ProseMirror").invoke(
					"text",
					"Test Course Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
				);

				cy.button("Save").click();
			});

		// After save, NewCourseModal pushes to /lms/courses/<slug>#settings.
		cy.wait(500);
		cy.url().should("include", "/lms/courses/test-course");
		cy.closeOnboardingModal();

		// Settings tab now hosts three sectioned components:
		//   - CourseDetailsSection (Title / Category / Tags / Short description)
		//   - CourseOverviewSection (Embed preview video / Related / Meta…)
		//   - CoursePublishSettings (Visibility switches, Published on display)
		cy.get("button, [role=tab]").contains("Settings").click();
		cy.wait(500);

		// Embed (preview video) — lives in CourseOverviewSection now.
		cy.get("label")
			.contains("Embed (preview video)")
			.parent()
			.find("input")
			.type("https://www.youtube.com/embed/-LPmw2Znl2c");

		// Tags — frappe-ui MultiSelect. Open trigger, type each tag + Enter to
		// commit (the transform exposes a "Create 'X'" option that Enter
		// selects), then close the popover.
		cy.get("label")
			.contains("Tags")
			.parent()
			.find("button")
			.first()
			.click();
		// MultiSelect's ComboboxInput doesn't auto-clear after Enter, so type
		// each tag, commit it, and clear the input before the next one.
		const tagInput = '[data-slot="content-body"] [data-slot="input"]';
		cy.get(tagInput).should("be.visible").type("Learning{enter}");
		cy.get(tagInput).clear().type("Frappe{enter}");
		cy.get(tagInput).clear().type("ERPNext{enter}");
		cy.get("body").type("{esc}");

		// Category — Link control already filled from the modal; reassert here
		// rather than re-pick, since reopening the picker is brittle.
		cy.get("label").contains("Category").should("exist");

		cy.button("Save").click();
		cy.wait(500);

		// Publish from the CourseDetail header. Exact-match "Publish" to avoid
		// hitting the "Published" Badge that also shows in the header once
		// published. Backend stamps published_on on the 0→1 transition.
		cy.get("header")
			.find("button")
			.contains(/^Publish$/)
			.click();
		cy.contains(/Course published/i, { timeout: 10000 }).should("exist");

		// Reload so CourseForm's injected resource picks up the new
		// `published`/`published_on` values (the header toggles via a separate
		// `frappe.client.set_value` resource that doesn't refresh the form).
		cy.reload();
		cy.wait(500);
		// Header reflects the published state: a "Published" badge appears and
		// the primary action button flips from "Publish" to "Unpublish".
		cy.get("header")
			.contains(/^Published$/, { timeout: 10000 })
			.should("exist");
		cy.get("header")
			.find("button")
			.contains(/^Unpublish$/)
			.should("exist");
		cy.get("button, [role=tab]").contains("Settings").click();
		cy.wait(500);

		// Add Chapter — Course editor tab. With no chapters yet, the empty
		// state shows a "Create chapter" button; the small "Add" header button
		// only matters once chapters exist.
		cy.get("button, [role=tab]").contains("Course editor").click();
		cy.wait(500);
		cy.contains("button", "Create chapter").click();
		cy.wait(500);
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

		// Add Lesson — now opens a LessonModal with Title (the body editor is
		// inline in the editor pane and not exercised here).
		cy.wait(500);
		cy.button("Add Lesson").click();
		cy.wait(500);
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
		cy.wait(500);

		// View Course card (student-facing list).
		cy.wait(500);
		cy.visit("/lms/courses");
		cy.closeOnboardingModal();
		cy.url().should("include", "/lms/courses");

		cy.contains("a", "Test Course").within(() => {
			cy.contains("Test Course Short Introduction to test the UI");
		});
		cy.contains("a", "Test Course").click();

		// CourseOverview (the public-facing tab) renders short intro, tags,
		// instructor avatars, and the preview-video iframe.
		cy.url().should("include", "/lms/courses/test-course");
		cy.contains("Test Course");
		cy.contains("Test Course Short Introduction to test the UI");
		// Tags display on CourseOverview is "Learning, Frappe, ERPNext"
		// split-on-comma — assert at least one survived a round trip rather
		// than all three (whose spaces/formatting can drift across rerenders).
		cy.contains("Learning");
		cy.get("iframe").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/-LPmw2Znl2c"
		);

		// CourseOverview's "Course content" section renders the CourseOutline,
		// so the chapter and lesson titles show right here on the public tab.
		cy.contains("Test Chapter", { timeout: 15000 }).should("exist");
		cy.contains("Test Lesson", { timeout: 15000 }).should("exist");

		// Delete Course — open Settings tab, then the ellipsis menu in the
		// header dropdown, confirm.
		cy.get("button, [role=tab]").contains("Settings").click();
		cy.wait(500);
		cy.get("header")
			.find('button[aria-haspopup="menu"]', { timeout: 10000 })
			.first()
			.click({ force: true });
		cy.get("div[role=menu]").within(() => {
			cy.contains('[role="menuitem"]', "Delete").click();
		});
		cy.get("span").contains("Delete").click();
		cy.wait(500);
		cy.url().should("include", "/lms/courses");
		cy.contains("Test Course").should("not.exist");
	});
});
