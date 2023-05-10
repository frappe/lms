describe("Course Creation", () => {
	it("creates a new course", () => {
		cy.login();
		cy.visit("/courses");
		// Create a course
		cy.get("a.btn").contains("Create a Course").click();
		cy.wait(1000);
		cy.url().should("include", "/courses/new-course/edit");
		cy.get("#title").type("Test Course");
		cy.get("#intro").type("Test Course Short Introduction");
		cy.get("#description").type("Test Course Description");
		cy.get("#video-link").type("-LPmw2Znl2c");
		cy.get("#tags-input").type("Test");
		cy.get("#published").check();
		cy.wait(1000);
		cy.button("Save").click();

		// Add Chapter
		cy.wait(1000);
		cy.link("Course Outline").click();

		cy.wait(1000);
		cy.get(".edit-header .btn-add-chapter").click();
		cy.get("#chapter-title").type("Test Chapter");
		cy.get("#chapter-description").type("Test Chapter Description");
		cy.button("Save").click();

		// Add Lesson
		cy.wait(1000);
		cy.link("Add Lesson").click();
		cy.wait(1000);
		cy.get("#lesson-title").type("Test Lesson");

		// Content
		cy.get(".ce-block").click().type("{enter}");
		cy.get(".ce-toolbar__plus").click();
		cy.get('[data-item-name="youtube"]').click();
		cy.get('input[data-fieldname="youtube"]').type("GoDtyItReto");
		cy.button("Insert").click();
		cy.wait(1000);

		cy.get(".ce-block:last").click().type("{enter}");
		cy.get(".ce-block:last")
			.click()
			.type(
				"This is an extremely big paragraph that is meant to test the UI. This is a very long paragraph. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
			);
		cy.button("Save").click();

		// View Course
		cy.wait(1000);
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
		cy.wait(1000);
		cy.url().should("include", "learn/1.1");
		cy.get("#title").contains("Test Lesson");
		cy.get(".lesson-video iframe").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/GoDtyItReto"
		);
		cy.get(".lesson-content-card").contains(
			"This is an extremely big paragraph that is meant to test the UI. This is a very long paragraph. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
		);

		// Add Discussion
		cy.get(".reply").click();
		cy.wait(500);
		cy.get(".topic-title").type("Question Title");
		cy.get(".comment-field").type(
			"Question Content. This is a very long question. It contains more than once sentence. Its meant to be this long as this is a UI test."
		);
		cy.get(".submit-discussion").click();

		// View Discussion
		cy.wait(1000);
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
