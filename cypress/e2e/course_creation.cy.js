describe("Course Creation", () => {
	it("creates a new course", () => {
		cy.login();
		cy.wait(1000);
		cy.visit("/lms/courses");

		// Create a course
		cy.get("button").contains("New").click();
		cy.wait(1000);
		cy.url().should("include", "/courses/new/edit");

		cy.get("label").contains("Title").type("Test Course");
		cy.get("label")
			.contains("Short Introduction")
			.type("Test Course Short Introduction to test the UI");
		cy.get("div[contenteditable=true").invoke(
			"text",
			"Test Course Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
		);

		cy.fixture("profile.png", "base64").then((fileContent) => {
			cy.get('input[type="file"]').attachFile({
				fileContent,
				fileName: "profile.png",
				mimeType: "image/png",
				encoding: "base64",
			});
		});

		cy.get("label")
			.contains("Preview Video")
			.type("https://www.youtube.com/embed/-LPmw2Znl2c");
		cy.get("[id=tags]").type("Learning{enter}Frappe{enter}ERPNext{enter}");
		cy.get("label")
			.contains("Category")
			.parent()
			.within(() => {
				cy.get("button").click();
			});
		cy.get("[id^=headlessui-combobox-option-")
			.should("be.visible")
			.first()
			.click();

		/* Instructor */
		cy.get("label")
			.contains("Instructors")
			.parent()
			.within(() => {
				cy.get("input").click().type("frappe");
				cy.get("input")
					.invoke("attr", "aria-controls")
					.as("instructor_list_id");
			});
		cy.get("@instructor_list_id").then((instructor_list_id) => {
			cy.get(`[id^=${instructor_list_id}`)
				.should("be.visible")
				.within(() => {
					cy.get("[id^=headlessui-combobox-option-").first().click();
				});
		});

		cy.get("label").contains("Published").click();
		cy.get("label").contains("Published On").type("2021-01-01");
		cy.button("Save").click();

		// Add Chapter
		cy.wait(1000);
		cy.button("Add Chapter").click();

		cy.wait(1000);
		cy.get("[id^=headlessui-dialog-panel-")
			.should("be.visible")
			.within(() => {
				cy.get("label").contains("Title").type("Test Chapter");
				cy.button("Create").click();
			});

		// Add Lesson
		cy.wait(1000);
		cy.button("Add Lesson").click();
		cy.wait(1000);
		cy.url().should("include", "/learn/1-1/edit");
		cy.wait(1000);

		cy.get("label").contains("Title").type("Test Lesson");
		cy.get("#content .ce-block").type(
			"{enter}This is an extremely big paragraph that is meant to test the UI. This is a very long paragraph. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
		);
		cy.button("Save").click();

		// View Course
		cy.wait(1000);
		cy.visit("/lms");
		cy.wait(500);
		cy.url().should("include", "/lms/courses");
		cy.get(".grid a:first").within(() => {
			cy.get("div").contains("Test Course");
			cy.get("div").contains(
				"Test Course Short Introduction to test the UI"
			);
			cy.get(".course-image")
				.invoke("css", "background-image")
				.should("include", "/files/profile");
		});
		cy.get(".grid a:first").click();
		cy.url().should("include", "/lms/courses/test-course");
		cy.get("div").contains("Test Course");
		cy.get("div").contains("Test Course Short Introduction to test the UI");
		cy.get("div").contains("Learning");
		cy.get("div").contains("Frappe");
		cy.get("div").contains("ERPNext");
		cy.get("iframe").should(
			"have.attr",
			"src",
			"https://www.youtube.com/embed/-LPmw2Znl2c"
		);

		// View Chapter
		cy.get("div").contains("Test Chapter");
		cy.get("[id^=headlessui-disclosure-panel-").within(() => {
			cy.get("div").contains("Test Lesson").click();
		});
		cy.wait(3000);

		// View Lesson
		cy.url().should("include", "/learn/1-1");
		cy.get("div").contains("Test Lesson");

		cy.get("div").contains(
			"This is an extremely big paragraph that is meant to test the UI. This is a very long paragraph. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
		);

		// Add Discussion
		cy.button("New Question").click();
		cy.wait(500);
		cy.get("[id^=headlessui-dialog-panel-").within(() => {
			cy.get("label").contains("Title").type("Test Discussion");
			cy.get("div[contenteditable=true]").invoke(
				"text",
				"This is a test discussion. This will check if the UI is working properly."
			);
			cy.button("Post").click();
		});

		// View Discussion
		cy.wait(500);
		cy.get("div").contains("Test Discussion").click();
		cy.get("div[contenteditable=true").invoke(
			"text",
			"This is a test comment. This will check if the UI is working properly."
		);

		cy.get("div").contains(
			"This is a test comment. This will check if the UI is working properly."
		);
	});
});
