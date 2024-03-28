import {
	x as c,
	y as _,
	H as s,
	a4 as x,
	L as o,
	J as d,
	G as L,
	K as n,
	a7 as P,
	d as T,
	s as j,
	k as f,
	a as z,
	I,
	M as b,
	ai as u,
} from "./frappe-ui-n1bXVQkV.js";
import { _ as S } from "./Link-xVzNCgtj.js";
import { c as V } from "./index-xt-hKVBz.js";
import "./plus-w56hNznP.js";
const E = { class: "text-base border rounded-md w-1/3 mx-auto my-32" },
	G = { class: "border-b px-5 py-3 font-medium" },
	R = s(
		"span",
		{
			class: "inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2",
		},
		null,
		-1
	),
	D = { class: "px-5 py-3" },
	H = { class: "mb-4 leading-6" },
	C = {
		__name: "NotPermitted",
		props: {
			title: { type: String, default: "Not Permitted" },
			text: {
				type: String,
				default: "You are not permitted to access this page.",
			},
			buttonLabel: { type: String, default: "Login" },
			buttonLink: { type: String, default: "/login" },
		},
		setup(m) {
			const v = m,
				r = () => {
					window.location.href = v.buttonLink;
				};
			return (p, i) => (
				c(),
				_("div", E, [
					s("div", G, [R, x(" " + o(p.__(m.title)), 1)]),
					s("div", D, [
						s("div", H, o(p.__(m.text)), 1),
						d(
							n(P),
							{
								variant: "solid",
								class: "w-full",
								onClick: i[0] || (i[0] = (t) => r()),
							},
							{
								default: L(() => [
									x(o(p.__(m.buttonLabel)), 1),
								]),
								_: 1,
							}
						),
					]),
				])
			);
		},
	},
	K = { class: "text-base h-screen" },
	q = { key: 0, class: "mt-10 w-1/2 mx-auto" },
	J = { class: "text-3xl font-bold" },
	O = { class: "text-gray-600 mt-1" },
	F = { class: "border rounded-md p-5 mt-5" },
	W = { class: "text-xl font-semibold" },
	Y = { class: "text-gray-600 mt-1" },
	Q = { class: "mt-5" },
	X = { class: "flex items-center justify-between" },
	Z = { key: 0, class: "flex items-center justify-between mt-2" },
	ee = { key: 1, class: "flex items-center justify-between mt-2" },
	te = { class: "font-semibold text-2xl" },
	se = { class: "text-xl font-semibold mt-10" },
	ae = { class: "text-gray-600 mt-1" },
	oe = { class: "grid grid-cols-2 gap-5 mt-4" },
	ne = { class: "mt-4" },
	le = { class: "mb-1.5 text-sm text-gray-700" },
	ie = { class: "mt-4" },
	de = { class: "mb-1.5 text-sm text-gray-700" },
	re = { class: "mt-4" },
	me = { class: "mb-1.5 text-sm text-gray-700" },
	ue = { class: "mt-4" },
	ce = { class: "mb-1.5 text-sm text-gray-700" },
	_e = { class: "mt-4" },
	pe = { class: "mb-1.5 text-sm text-gray-700" },
	ye = { class: "mt-4" },
	he = { class: "mb-1.5 text-sm text-gray-700" },
	ge = { class: "mt-4" },
	be = { class: "mb-1.5 text-sm text-gray-700" },
	ve = { class: "mt-4" },
	fe = { class: "mb-1.5 text-sm text-gray-700" },
	xe = { class: "mt-4" },
	ke = { class: "mb-1.5 text-sm text-gray-700" },
	Se = { key: 0, class: "mt-4" },
	Ve = { class: "mb-1.5 text-sm text-gray-700" },
	Ce = { key: 1, class: "mt-4" },
	Le = { class: "mb-1.5 text-sm text-gray-700" },
	Pe = { key: 1 },
	we = { key: 2 },
	Ue = {
		__name: "Billing",
		props: {
			type: { type: String, required: !0 },
			name: { type: String, required: !0 },
		},
		setup(m) {
			const v = T("$user");
			j(() => {
				var a;
				const e = document.createElement("script");
				(e.src = "https://checkout.razorpay.com/v1/checkout.js"),
					document.body.appendChild(e),
					(a = v.data) != null && a.name && p.submit();
			});
			const r = m,
				p = f({
					url: "lms.lms.api.validate_billing_access",
					params: { type: r.type, name: r.name },
					onSuccess(e) {
						i.submit(), w(e.address);
					},
				}),
				i = f({
					url: "lms.lms.utils.get_order_summary",
					makeParams(e) {
						return {
							doctype:
								r.type == "course" ? "LMS Course" : "LMS Batch",
							docname: r.name,
							country: t.country,
						};
					},
					onError(e) {
						k(e);
					},
				}),
				t = z({}),
				w = (e) => {
					(t.billing_name = e.billing_name || ""),
						(t.address_line1 = e.address_line1 || ""),
						(t.address_line2 = e.address_line2 || ""),
						(t.city = e.city || ""),
						(t.state = e.state || ""),
						(t.country = e.country || ""),
						(t.pincode = e.pincode || ""),
						(t.phone = e.phone || ""),
						(t.source = e.source || ""),
						(t.gstin = e.gstin || ""),
						(t.pan = e.pan || "");
				},
				M = f({
					url: "lms.lms.utils.get_payment_options",
					makeParams(e) {
						return {
							doctype:
								r.type == "course" ? "LMS Course" : "LMS Batch",
							docname: r.name,
							phone: t.phone,
							country: t.country,
						};
					},
				}),
				B = () => {
					M.submit(
						{},
						{
							validate(e) {
								return U();
							},
							onSuccess(e) {
								(e.handler = (y) => {
									let h =
											r.type == "course"
												? "LMS Course"
												: "LMS Batch",
										g = r.name;
									N(y, h, g, e.order_id);
								}),
									new Razorpay(e).open();
							},
							onError(e) {
								k(e);
							},
						}
					);
				},
				$ = f({
					url: "lms.lms.utils.verify_payment",
					makeParams(e) {
						return {
							response: e.response,
							doctype:
								r.type == "course" ? "LMS Course" : "LMS Batch",
							docname: r.name,
							address: t,
							order_id: e.orderId,
						};
					},
				}),
				N = (e, a, y, h) => {
					$.submit(
						{ response: e, orderId: h },
						{
							onSuccess(g) {
								V({
									title: "Success",
									text: "Payment Successful",
									icon: "check",
									iconClasses:
										"bg-green-600 text-white rounded-md p-px",
								}),
									setTimeout(() => {
										window.location.href = g;
									}, 3e3);
							},
						}
					);
				},
				U = () => {
					let e = [
						"billing_name",
						"address_line1",
						"city",
						"pincode",
						"country",
						"phone",
						"source",
					];
					for (let y of e)
						if (!t[y])
							return (
								"Please enter a valid " +
								y
									.replaceAll("_", " ")
									.toLowerCase()
									.replace(/\b\w/g, (h) => h.toUpperCase())
							);
					if (t.gstin && !t.pan)
						return "Please enter a valid pan number.";
					if (t.country == "India" && !t.state)
						return "Please enter a valid state with correct spelling and the first letter capitalized.";
					const a = [
						"Andhra Pradesh",
						"Arunachal Pradesh",
						"Assam",
						"Bihar",
						"Chhattisgarh",
						"Goa",
						"Gujarat",
						"Haryana",
						"Himachal Pradesh",
						"Jharkhand",
						"Karnataka",
						"Kerala",
						"Madhya Pradesh",
						"Maharashtra",
						"Manipur",
						"Meghalaya",
						"Mizoram",
						"Nagaland",
						"Odisha",
						"Punjab",
						"Rajasthan",
						"Sikkim",
						"Tamil Nadu",
						"Telangana",
						"Tripura",
						"Uttar Pradesh",
						"Uttarakhand",
						"West Bengal",
					];
					if (t.country == "India" && !a.includes(t.state))
						return "Please enter a valid state with correct spelling and the first letter capitalized.";
				},
				k = (e) => {
					var a;
					V({
						title: "Error",
						text: ((a = e.messages) == null ? void 0 : a[0]) || e,
						icon: "x",
						iconClasses: "bg-red-600 text-white rounded-md p-px",
						position: "top-center",
						timeout: 10,
					});
				},
				A = (e) => {
					(t.country = e), i.reload();
				};
			return (e, a) => {
				var y, h, g;
				return (
					c(),
					_("div", K, [
						(y = n(p).data) != null && y.access && n(i).data
							? (c(),
							  _("div", q, [
									s("div", J, o(e.__("Billing Details")), 1),
									s(
										"div",
										O,
										o(
											e.__(
												"Enter the billing information to complete the payment."
											)
										),
										1
									),
									s("div", F, [
										s("div", W, o(e.__("Summary")), 1),
										s(
											"div",
											Y,
											o(
												e.__(
													"Review the details of your purchase."
												)
											),
											1
										),
										s("div", Q, [
											s("div", X, [
												s(
													"div",
													null,
													o(n(i).data.title),
													1
												),
												s(
													"div",
													{
														class: I({
															"font-semibold text-xl":
																!n(i).data
																	.gst_applied,
														}),
													},
													o(
														n(i).data.gst_applied
															? n(i).data
																	.original_amount_formatted
															: n(i).data
																	.total_amount_formatted
													),
													3
												),
											]),
											n(i).data.gst_applied
												? (c(),
												  _("div", Z, [
														s(
															"div",
															null,
															o(
																e.__(
																	"GST Amount"
																)
															),
															1
														),
														s(
															"div",
															null,
															o(
																n(i).data
																	.gst_amount_formatted
															),
															1
														),
												  ]))
												: b("", !0),
											n(i).data.gst_applied
												? (c(),
												  _("div", ee, [
														s(
															"div",
															null,
															o(
																e.__(
																	"Total Amount"
																)
															),
															1
														),
														s(
															"div",
															te,
															o(
																n(i).data
																	.total_amount_formatted
															),
															1
														),
												  ]))
												: b("", !0),
										]),
										s("div", se, o(e.__("Address")), 1),
										s(
											"div",
											ae,
											o(
												e.__(
													"Specify your billing address correctly."
												)
											),
											1
										),
										s("div", oe, [
											s("div", null, [
												s("div", ne, [
													s(
														"div",
														le,
														o(e.__("Billing Name")),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue:
																t.billing_name,
															"onUpdate:modelValue":
																a[0] ||
																(a[0] = (l) =>
																	(t.billing_name =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", ie, [
													s(
														"div",
														de,
														o(
															e.__(
																"Address Line 1"
															)
														),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue:
																t.address_line1,
															"onUpdate:modelValue":
																a[1] ||
																(a[1] = (l) =>
																	(t.address_line1 =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", re, [
													s(
														"div",
														me,
														o(
															e.__(
																"Address Line 2"
															)
														),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue:
																t.address_line2,
															"onUpdate:modelValue":
																a[2] ||
																(a[2] = (l) =>
																	(t.address_line2 =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", ue, [
													s(
														"div",
														ce,
														o(e.__("City")),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue: t.city,
															"onUpdate:modelValue":
																a[3] ||
																(a[3] = (l) =>
																	(t.city =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", _e, [
													s(
														"div",
														pe,
														o(e.__("State")),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue: t.state,
															"onUpdate:modelValue":
																a[4] ||
																(a[4] = (l) =>
																	(t.state =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
											]),
											s("div", null, [
												s("div", ye, [
													s(
														"div",
														he,
														o(e.__("Country")),
														1
													),
													d(
														S,
														{
															doctype: "Country",
															value: t.country,
															onChange:
																a[5] ||
																(a[5] = (l) =>
																	A(l)),
														},
														null,
														8,
														["value"]
													),
												]),
												s("div", ge, [
													s(
														"div",
														be,
														o(e.__("Postal Code")),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue:
																t.pincode,
															"onUpdate:modelValue":
																a[6] ||
																(a[6] = (l) =>
																	(t.pincode =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", ve, [
													s(
														"div",
														fe,
														o(e.__("Phone Number")),
														1
													),
													d(
														n(u),
														{
															type: "text",
															modelValue: t.phone,
															"onUpdate:modelValue":
																a[7] ||
																(a[7] = (l) =>
																	(t.phone =
																		l)),
														},
														null,
														8,
														["modelValue"]
													),
												]),
												s("div", xe, [
													s(
														"div",
														ke,
														o(e.__("Source")),
														1
													),
													d(
														S,
														{
															doctype:
																"LMS Source",
															value: t.source,
															onChange:
																a[8] ||
																(a[8] = (l) =>
																	(t.source =
																		l)),
														},
														null,
														8,
														["value"]
													),
												]),
												t.country == "India"
													? (c(),
													  _("div", Se, [
															s(
																"div",
																Ve,
																o(
																	e.__(
																		"GST Number"
																	)
																),
																1
															),
															d(
																n(u),
																{
																	type: "text",
																	modelValue:
																		t.gstin,
																	"onUpdate:modelValue":
																		a[9] ||
																		(a[9] =
																			(
																				l
																			) =>
																				(t.gstin =
																					l)),
																},
																null,
																8,
																["modelValue"]
															),
													  ]))
													: b("", !0),
												t.country == "India"
													? (c(),
													  _("div", Ce, [
															s(
																"div",
																Le,
																o(
																	e.__(
																		"Pan Number"
																	)
																),
																1
															),
															d(
																n(u),
																{
																	type: "text",
																	modelValue:
																		t.pan,
																	"onUpdate:modelValue":
																		a[10] ||
																		(a[10] =
																			(
																				l
																			) =>
																				(t.pan =
																					l)),
																},
																null,
																8,
																["modelValue"]
															),
													  ]))
													: b("", !0),
											]),
										]),
										d(
											n(P),
											{
												variant: "solid",
												class: "mt-8",
												onClick:
													a[11] ||
													(a[11] = (l) => B()),
											},
											{
												default: L(() => [
													x(
														o(
															e.__(
																"Proceed to Payment"
															)
														),
														1
													),
												]),
												_: 1,
											}
										),
									]),
							  ]))
							: (h = n(p).data) != null && h.message
							? (c(),
							  _("div", Pe, [
									d(
										C,
										{
											text: n(p).data.message,
											buttonLabel:
												m.type == "course"
													? "Checkout Courses"
													: "Checkout Batches",
											buttonLink:
												m.type == "course"
													? "/courses"
													: "/batches",
										},
										null,
										8,
										["text", "buttonLabel", "buttonLink"]
									),
							  ]))
							: (g = n(v).data) != null && g.name
							? b("", !0)
							: (c(),
							  _("div", we, [
									d(
										C,
										{
											text: "Please login to access this page.",
											buttonLink: `/login?redirect-to=/billing/${m.type}/${m.name}`,
										},
										null,
										8,
										["buttonLink"]
									),
							  ])),
					])
				);
			};
		},
	};
export { Ue as default };
//# sourceMappingURL=Billing-kqTZfaAQ.js.map
