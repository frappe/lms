// Copyright (c) 2024, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on('Student Registration', {
    refresh(frm) {
        apply_filter("state_name", "country_name", frm, frm.doc.country);
        apply_filter("district_name", "state_name", frm, frm.doc.state);
    },
    country_name(frm) {
        apply_filter("state_name", "country_name", frm, frm.doc.country);
    },
    state_name(frm) {
        apply_filter("district_name", "state_name", frm, frm.doc.state);
    },
    country_name(frm) {
        frm.set_value({
            "state_name": "",
            "district_name": "",
        })
    },
    state_name(frm) {
        frm.set_value({
            "district_name": "",
        })
    },
    fetch_location: function (frm) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                let latitude = position.coords.latitude;
                let longitude = position.coords.longitude;
                frm.set_value('latitude', latitude);
                frm.set_value('longitude', longitude);
                let geoJSON = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {},
                            "geometry": {
                                "type": "Point",
                                "coordinates": [longitude, latitude]
                            }
                        }
                    ]
                };
                frm.set_value('farm_geocordinats', JSON.stringify(geoJSON));
            });
        } else {
            frappe.msgprint({
                title: __('Error'),
                message: __('Geolocation is not supported by this browser.'),
                indicator: 'red'
            });
        }
    }
});
