import {
	x as r,
	F as s,
	ar as t,
	K as l,
	ao as u,
	M as n,
} from "./frappe-ui-n1bXVQkV.js";
const i = {
	__name: "UserAvatar",
	props: { user: { type: Object, default: null }, size: { type: String } },
	setup(e) {
		return (a, m) =>
			e.user
				? (r(),
				  s(
						l(u),
						t(
							{
								key: 0,
								class: "avatar border border-gray-300",
								label: e.user.full_name,
								image: e.user.user_image,
								size: e.size,
							},
							a.$attrs
						),
						null,
						16,
						["label", "image", "size"]
				  ))
				: n("", !0);
	},
};
export { i as _ };
//# sourceMappingURL=UserAvatar-3mSOKoKa.js.map
