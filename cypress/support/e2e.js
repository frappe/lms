// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Chrome reports "ResizeObserver loop completed with undelivered notifications"
// as an uncaught error, and Cypress fails whatever test is running when it
// lands. It is a notification that the observer callbacks did not settle inside
// one frame, not a thrown exception: nothing is broken and the app carries on.
// It fires here on the combobox dropdowns that reposition themselves inside a
// dialog (the Student picker on the enroll form, ~50% of the time locally), and
// which test it hits is down to timing.
//
// Scoped to this one message on purpose — every other uncaught error still
// fails the test it happens in.
Cypress.on("uncaught:exception", (err) =>
	/ResizeObserver loop/.test(err.message) ? false : undefined
);
