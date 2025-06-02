describe("Batch Creation", () => {
	it("creates a new batch", () => {
		cy.login();
		cy.wait(500);
		cy.visit("/lms/batches");

		// Close onboarding modal
		cy.closeOnboardingModal();

		// Create a batch
		cy.get("button").contains("New").click();
		cy.wait(500);
		cy.url().should("include", "/batches/new/edit");
		cy.get("label").contains("Title").type("Test Batch");

		cy.get("label").contains("Start Date").type("2030-10-01");
		cy.get("label").contains("End Date").type("2030-10-31");
		cy.get("label").contains("Start Time").type("10:00");
		cy.get("label").contains("End Time").type("11:00");
		cy.get("label").contains("Timezone").type("IST");
		cy.get("label").contains("Seat Count").type("10");
		cy.get("label").contains("Published").click();

		cy.get("label")
			.contains("Short Description")
			.type("Test Batch Short Description to test the UI");
		cy.get("div[contenteditable=true").invoke(
			"text",
			"Test Batch Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
		);

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

		cy.button("Save").click();
		cy.wait(1000);
		let batchName;
		cy.url().then((url) => {
			console.log(url);
			batchName = url.split("/").pop();
			cy.wrap(batchName).as("batchName");
		});
		cy.wait(500);

		// Add Student to system

		cy.get("span").contains("Learning").click();
		cy.get("span").contains("Settings").click();
		cy.get('[id^="headlessui-dialog-panel-v-"]')
			.find("span")
			.contains(/^Members$/)
			.should("have.text", "Members")
			.click();
		cy.get("button").contains("New").click();

		const dateNow = Date.now();
		const randomEmail = `testuser_${dateNow}@example.com`;
		const randomName = `Test User ${dateNow}`;

		cy.get("input[placeholder='Email']").type(randomEmail);
		cy.get("input[placeholder='First Name']").type(randomName);
		cy.get("button").contains("Add").click();
		cy.get("div").contains(randomName).should("be.visible").click();

		// View Batch
		cy.wait(1000);
		cy.visit("/lms/batches");
		cy.closeOnboardingModal();

		cy.url().should("include", "/lms/batches");

		cy.get('[id^="headlessui-radiogroup-v-"]')
			.find("span")
			.contains("Upcoming")
			.should("be.visible")
			.click();

		cy.get("@batchName").then((batchName) => {
			cy.get(`a[href='/lms/batches/details/${batchName}'`).within(() => {
				cy.get("div").contains("Test Batch").should("be.visible");
				cy.get("div")
					.contains("Test Batch Short Description to test the UI")
					.should("be.visible");
				cy.get("span")
					.contains("01 Oct 2030 - 31 Oct 2030")
					.should("be.visible");
				cy.get("span")
					.contains("10:00 AM - 11:00 AM")
					.should("be.visible");
				cy.get("span").contains("IST").should("be.visible");
				cy.get("a").contains("Frappe").should("be.visible");
				cy.get("div")
					.contains("10")
					.should("be.visible")
					.get("span")
					.contains("Seats Left")
					.should("be.visible");
			});
			cy.get(`a[href='/lms/batches/details/${batchName}'`).click();
		});

		cy.get("div").contains("Test Batch").should("be.visible");
		cy.get("div")
			.contains("Test Batch Short Description to test the UI")
			.should("be.visible");
		cy.get("a").contains("Frappe").should("be.visible");
		cy.get("span")
			.contains("01 Oct 2030 - 31 Oct 2030")
			.should("be.visible");
		cy.get("span").contains("10:00 AM - 11:00 AM").should("be.visible");
		cy.get("span").contains("IST").should("be.visible");
		cy.get("div")
			.contains("10")
			.should("be.visible")
			.get("span")
			.contains("Seats Left")
			.should("be.visible");

		cy.get("p")
			.contains(
				"Test Batch Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now."
			)
			.should("be.visible");
		cy.get("button").contains("Manage Batch").click();

		/* Add student to batch */
		cy.get("button").contains("Add").click();
		cy.get('div[id^="headlessui-dialog-panel-v-"]')
			.first()
			.find("button")
			.eq(1)
			.click();
		cy.get("input[id^='headlessui-combobox-input-v-']").type(randomEmail);
		cy.get("div").contains(randomEmail).click();
		cy.get("button").contains("Submit").click();

		// Verify Seat Count
		cy.get("span").contains("Details").click();
		cy.get("div")
			.contains("9")
			.should("be.visible")
			.get("span")
			.contains("Seats Left")
			.should("be.visible");
	});
});
