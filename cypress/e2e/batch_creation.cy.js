describe("Batch Creation", () => {
	const dateNow = Date.now();
	const randomEvaluator = `evaluator${dateNow}@example.com`;

	it("creates an evaluator via Members settings", () => {
		cy.login();
		cy.visit("/lms/batches");
		cy.closeOnboardingModal();

		// Open Settings → Members
		cy.get("span").contains("Learning").click();
		cy.contains('[role="menuitem"]', "Settings").click();
		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("Members")
			.click();

		// Create evaluator via New button
		cy.intercept("POST", "/api/method/frappe.client.insert").as(
			"userInsert"
		);
		cy.intercept("POST", "/api/method/lms.lms.api.save_role").as(
			"saveRole"
		);

		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("New")
			.click();

		cy.get("[data-dismissable-layer]")
			.find("input[placeholder='jane@doe.com']")
			.type(randomEvaluator);
		cy.get("[data-dismissable-layer]")
			.find("input[placeholder='Jane']")
			.type("Evaluator");

		// Toggle Evaluator role. frappe-ui's Switch renders a <label for=id>
		// linked to the switch button's id, so toggle via that association
		// (the role name is not wrapped in a <label> ancestor).
		cy.get("[data-dismissable-layer]")
			.contains("label", "Evaluator")
			.invoke("attr", "for")
			.then((id) => {
				cy.get(`[id="${id}"]`).click();
			});

		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("Add")
			.click();

		// Wait for API calls to complete
		cy.wait("@userInsert", { timeout: 15000 });
		cy.wait("@saveRole", { timeout: 15000 });

		// Modal closes on success
		cy.contains("Add New Member").should("not.exist");

		// Filter by Evaluator role to verify
		cy.get("[data-dismissable-layer]").within(() => {
			cy.get("button[role='combobox']").click();
		});
		cy.get('[role="listbox"]', { timeout: 10000 })
			.contains("Evaluator")
			.click();
		cy.get("[data-dismissable-layer]")
			.contains(randomEvaluator, { timeout: 10000 })
			.should("be.visible");
	});

	it("creates and verifies a new batch", () => {
		// Unique per attempt: on a retry the previous attempt's user already
		// exists, and re-adding it leaves the member modal open (insert errors).
		const randomStudent = `testuser_${Date.now()}@example.com`;

		cy.login();
		cy.visit("/lms/batches");
		cy.closeOnboardingModal();

		// The Enrol dialog's Student field is a User link that searches existing
		// users, so the student must exist before we can enrol them. Create it
		// via Members settings (mirrors the evaluator setup, without a role).
		cy.get("span").contains("Learning").click();
		cy.contains('[role="menuitem"]', "Settings").click();
		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("Members")
			.click();
		cy.intercept("POST", "/api/method/frappe.client.insert").as(
			"studentInsert"
		);
		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("New")
			.click();
		cy.get("[data-dismissable-layer]")
			.find("input[placeholder='jane@doe.com']")
			.type(randomStudent);
		cy.get("[data-dismissable-layer]")
			.find("input[placeholder='Jane']")
			.type("Student");
		cy.get("[data-dismissable-layer]")
			.find("button")
			.contains("Add")
			.click();
		cy.wait("@studentInsert", { timeout: 15000 });
		cy.contains("Add New Member").should("not.exist");

		// Back to the batch list to create the batch.
		cy.visit("/lms/batches");
		cy.closeOnboardingModal();

		// Create batch
		cy.get("button").contains("Create").click();
		cy.contains('[role="menuitem"]', "New Batch").click();

		cy.get("label")
			.contains("Title")
			.parent()
			.find("input")
			.type("Test Batch");
		cy.get("label")
			.contains("Start Date")
			.parent()
			.find("input")
			.type("2030-10-01");
		cy.get("label")
			.contains("End Date")
			.parent()
			.find("input")
			.type("2030-10-31");
		cy.get("label")
			.contains("Start Time")
			.parent()
			.find("input")
			.type("10:00");
		cy.get("label")
			.contains("End Time")
			.parent()
			.find("input")
			.type("11:00");

		// Timezone picker
		cy.get("label")
			.contains("Timezone")
			.parent()
			.within(() => {
				cy.get("input").click().clear().type("Asia/Kol");
				cy.get("input").invoke("attr", "aria-controls").as("tzList");
			});
		cy.get("@tzList").then((id) => {
			cy.get(`[id^=${id}]`)
				.should("be.visible")
				.within(() => {
					cy.get("[data-slot=item]").first().click();
				});
		});

		cy.get("label")
			.contains("Seat Count")
			.parent()
			.find("input")
			.clear()
			.type("10");
		cy.get("label")
			.contains("Description")
			.parent()
			.find("textarea")
			.type("Test Batch Short Description to test the UI");

		cy.get("div.ProseMirror")
			.click()
			.type(
				"Test Batch Description. I need a very big description to test the UI. This is a very big description."
			);

		// Pick the evaluator as instructor. MultiLink renders both a hidden
		// headlessui combobox button and the visible trigger button, so target
		// the visible one (.first() would grab the hidden one and fail).
		cy.get("label")
			.contains("Instructors")
			.parent()
			.find("button:visible")
			.first()
			.click();
		cy.get('[data-slot="content-body"] [data-slot="input"]')
			.should("be.visible")
			.type(randomEvaluator);
		// The option shows the user's name, not the email; typing the full unique
		// email filters the list to the single matching evaluator.
		cy.get('[data-slot="content-body"] [role="option"]', { timeout: 10000 })
			.should("have.length", 1)
			.first()
			.click();
		cy.get("body").type("{esc}");

		cy.button("Save").click();

		// Verify redirect to settings
		cy.url({ timeout: 10000 }).should("include", "#settings");
		cy.closeOnboardingModal();

		// Publish
		cy.button("Publish").click();
		cy.contains("div", "Published", { timeout: 10000 }).should(
			"be.visible"
		);
		cy.button("Unpublish").should("be.visible");

		// Capture batch slug
		let batchName;
		cy.url().then((url) => {
			batchName = url.split("/").pop().split("#")[0];
			cy.wrap(batchName).as("batchName");
		});

		// View batch card in list
		cy.visit("/lms/batches");
		cy.closeOnboardingModal();
		cy.url().should("include", "/lms/batches");
		cy.contains('[role="radio"]', "Upcoming").click();

		cy.get("@batchName").then((batchName) => {
			cy.get(`a[href='/lms/batches/${batchName}']`, {
				timeout: 10000,
			}).within(() => {
				cy.contains("Test Batch").should("be.visible");
				cy.contains(
					"Test Batch Short Description to test the UI"
				).should("be.visible");
				cy.contains("01 Oct 2030 - 31 Oct 2030").should("be.visible");
				cy.contains("10:00 AM - 11:00 AM").should("be.visible");
				cy.contains("Asia/Kolkata").should("be.visible");
				cy.contains("Evaluator").should("be.visible");
				cy.contains("10 Seats Left").should("be.visible");
			});
			cy.get(`a[href='/lms/batches/${batchName}']`).click();
		});

		// Batch detail page
		cy.contains("Test Batch", { timeout: 10000 }).should("be.visible");
		cy.contains("Test Batch Short Description to test the UI").should(
			"be.visible"
		);
		cy.contains("Evaluator").should("be.visible");
		// BatchOverview renders BatchOverlay twice for responsive layouts: a
		// mobile copy (`md:hidden`, first in the DOM) and a desktop copy
		// (`hidden md:block`). Plain cy.contains matches the first DOM node, i.e.
		// the mobile copy, which is display:none on the desktop test viewport.
		// Scope these assertions to the visible overlay.
		cy.get(".border-2.rounded-md.lg\\:w-72")
			.filter(":visible")
			.first()
			.within(() => {
				cy.contains("01 Oct 2030 - 31 Oct 2030").should("be.visible");
				cy.contains("10:00 AM - 11:00 AM").should("be.visible");
				cy.contains("Asia/Kolkata").should("be.visible");
				cy.contains("10 Seats Left").should("be.visible");
			});
		cy.contains(
			"Test Batch Description. I need a very big description to test the UI."
		).should("be.visible");

		// Enroll student
		cy.button("Dashboard").click();
		cy.closeOnboardingModal();
		cy.button("Enroll").click();
		cy.get('div[role="dialog"]')
			.first()
			.within(() => {
				cy.get("label")
					.contains("Student")
					.parent()
					.find("input")
					.click()
					.type(randomStudent);
			});
		cy.get("[data-slot=item]", { timeout: 10000 }).first().click();
		cy.button("Submit").click();

		// Verify seat count (scope to the visible overlay; the mobile md:hidden
		// copy is first in the DOM but display:none on this viewport).
		cy.button("Overview").click();
		cy.get(".border-2.rounded-md.lg\\:w-72")
			.filter(":visible")
			.first()
			.within(() => {
				cy.contains("9 Seats Left", { timeout: 10000 }).should(
					"be.visible"
				);
			});
	});
});
