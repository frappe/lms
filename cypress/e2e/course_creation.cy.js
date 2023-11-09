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
		cy.wait(500);
		cy.get("#chapter-title").type("Test Chapter");
		cy.get("#chapter-description").type("Test Chapter Description");
		cy.button("Save").click();

		// Add Lesson
		cy.wait(1000);
		cy.link("Add Lesson").click();
		cy.wait(1000);
		cy.get("#lesson-title").type("Test Lesson");

		// Content
		cy.get(".collapse-section.collapsed:first").click();
		cy.get("#lesson-content .ce-block")
			.click()
			.type(
				"This is an extremely big paragraph that is meant to test the UI. This is a very long paragraph. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now. {enter}"
			);
		cy.get("#lesson-content .ce-toolbar__plus").click();
		cy.get('#lesson-content [data-item-name="youtube"]').click();
		cy.get('input[data-fieldname="youtube"]').type("GoDtyItReto");
		cy.button("Insert").click();
		cy.wait(1000);
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
		cy.get(".discussion-modal").should("be.visible");

		// Enter title
		cy.get(".modal .topic-title")
			.type("Discussion from tests")
			.should("have.value", "Discussion from tests");

		// Enter comment
		cy.get(".modal .discussions-comment").type(
			"This is a discussion from the cypress ui tests."
		);

		// Submit
		cy.get(".modal .submit-discussion").click();
		cy.wait(2000);

		// Check if discussion is added to page and content is visible
		cy.get(".sidebar-parent:first .discussion-topic-title").should(
			"have.text",
			"Discussion from tests"
		);
		cy.get(".sidebar-parent:first .discussion-topic-title").click();
		cy.get(".discussion-on-page:visible").should("have.class", "show");
		cy.get(
			".discussion-on-page:visible .reply-card .reply-text .ql-editor p"
		).should(
			"have.text",
			"This is a discussion from the cypress ui tests."
		);

		cy.get(".discussion-form:visible .discussions-comment").type(
			"This is a discussion from the cypress ui tests. \n\nThis comment was entered through the commentbox on the page."
		);

		cy.get(".discussion-form:visible .submit-discussion").click();
		cy.wait(3000);
		cy.get(".discussion-on-page:visible").should("have.class", "show");
		cy.get(".discussion-on-page:visible")
			.children(".reply-card")
			.eq(1)
			.find(".reply-text")
			.should(
				"have.text",
				"This is a discussion from the cypress ui tests. This comment was entered through the commentbox on the page.\n"
			);
	});
});
