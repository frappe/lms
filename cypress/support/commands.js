// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import "cypress-file-upload";

Cypress.Commands.add("login", (email, password) => {
	if (!email) {
		email = Cypress.config("testUser") || "Administrator";
	}
	if (!password) {
		password = Cypress.config("adminPassword");
	}
	cy.request({
		url: "/api/method/login",
		method: "POST",
		body: { usr: email, pwd: password },
		timeout: 60000,
		retryOnStatusCodeFailure: true,
		retryOnNetworkFailure: true,
	});
});

Cypress.Commands.add("button", (text) => {
	return cy.get(`button:contains("${text}")`);
});

Cypress.Commands.add("link", (text) => {
	return cy.get(`a:contains("${text}")`);
});

Cypress.Commands.add("iconButton", (text) => {
	return cy.get(`button[aria-label="${text}"]`);
});

Cypress.Commands.add("dialog", (selector) => {
	return cy.get(`[role=dialog] ${selector}`);
});

Cypress.Commands.add("paste", { prevSubject: true }, (subject, text) => {
	cy.wrap(subject).then(($element) => {
		const element = $element[0];
		element.focus();
		element.textContent = text;
		const event = new Event("paste", { bubbles: true });
		element.dispatchEvent(event);
	});
});
