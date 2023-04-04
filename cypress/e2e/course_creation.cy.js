describe("Course Creation", () => {
	it("creates a new course", () => {
		cy.login();
		cy.visit("/courses");
		// Create a course
		cy.get("a.btn").contains("Create a Course").click();
		cy.wait(1000);
		cy.url().should("include", "/courses/new-course");
		cy.button("Add Tag").click();
		cy.get(".course-card-pills").type("Test");
		cy.get("#title").type("Test Course");
		cy.get("#intro").type("Test Course Short Introduction");
		cy.get("#video-link").type("-LPmw2Znl2c");
		cy.get("#published").check();
		cy.get("#description").type("Test Course Description");
		cy.wait(1000);
		cy.button("Save Course Details").click();

		// Add Chapter
		cy.wait(3000);
		cy.button("New Chapter").click();
		cy.get(".new-chapter .chapter-title-main").type("Test Chapter");
		cy.get(".new-chapter .chapter-description").type(
			"Test Chapter Description"
		);
		cy.get(".new-chapter .btn-save-chapter").click();

		// Add Lesson
		cy.wait(3000);
		cy.get(".chapter-parent .btn-lesson").click();

		cy.wait(3000);
		cy.get("#title").type("Test Lesson");
		cy.get("#youtube").type("GoDtyItReto");
		cy.get("#body").type("Test Lesson Content");
		cy.wait(1000);
		cy.get(".btn-lesson").click();

		// View Course
		cy.wait(3000);
		cy.visit("/courses");
		cy.get(".course-card-title:first").contains("Test Course");
		cy.get(".course-card:first").click();
		cy.url().should("include", "/courses/test-course");
		cy.get("#title").contains("Test Course");
		cy.get(".preview-video").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/-LPmw2Znl2c"
		);
		cy.get("#intro").contains("Test Course Short Introduction");

		// View Chapter
		cy.get(".chapter-title-main:first").contains("Test Chapter");
		cy.get(".chapter-description:first").contains(
			"Test Chapter Description"
		);
		cy.get(".lesson-info:first").contains("Test Lesson");
		cy.get(".lesson-info:first").click();

		// View Lesson
		cy.wait(3000);
		cy.url().should("include", "learn/1.1");
		cy.get("#title").contains("Test Lesson");
		cy.get(".lesson-video iframe").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/GoDtyItReto"
		);
		cy.get(".lesson-content-card").contains("Test Lesson Content");

		// Add Discussion
		cy.get(".reply").click();
		cy.wait(500);
		cy.get(".topic-title").type("Question Title");
		cy.get(".comment-field").type(
			"Question Content. This is a very long question. It contains more than once sentence. Its meant to be this long as this is a UI test."
		);
		cy.get(".submit-discussion").click();

		// View Discussion
		cy.wait(3000);
		cy.get(".discussion-topic-title:first").contains("Question Title");
		cy.get(".sidebar-parent:first").click();
		cy.get(".reply-text").contains(
			"Question Content. This is a very long question. It contains more than once sentence. Its meant to be this long as this is a UI test."
		);
		cy.get(".comment-field:visible").type(
			"This is a reply to the previous comment. Its not that long."
		);
		cy.get(".submit-discussion:visible").click();
		cy.wait(1000);
		cy.get(".reply-text:last p").contains(
			"This is a reply to the previous comment. Its not that long."
		);
	});
});
