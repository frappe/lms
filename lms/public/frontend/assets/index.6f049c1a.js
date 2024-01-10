var u = Object.defineProperty;
var o = Object.getOwnPropertySymbols;
var i = Object.prototype.hasOwnProperty,
	c = Object.prototype.propertyIsEnumerable;
var n = (t, e, r) =>
		e in t
			? u(t, e, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: r,
			  })
			: (t[e] = r),
	a = (t, e) => {
		for (var r in e || (e = {})) i.call(e, r) && n(t, r, e[r]);
		if (o) for (var r of o(e)) c.call(e, r) && n(t, r, e[r]);
		return t;
	};
import { ac as s, ad as f } from "./frappe-ui.a747cf9c.js";
function y(t) {
	s(a({ position: "bottom-right" }, t));
}
function d(t) {
	return f(t).value;
}
function g(t) {
	if (!t) return "";
	const [e, r] = t.split(":").map(Number),
		m = new Date(0, 0, 0, e, r);
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "numeric",
		hour12: !0,
	}).format(m);
}
function h(t, e) {
	return t
		? t.toLocaleString("en-IN", {
				maximumFractionDigits: 0,
				style: "currency",
				currency: e,
		  })
		: "";
}
export { h as a, y as c, g as f, d as t };
