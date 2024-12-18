frappe.ready(function () {

	// Insert button below the specified field
	document.querySelector('[data-fieldname="willingness_to_provide_at_least_05_ha_12_ac"]')
		.insertAdjacentHTML('beforeend', '<button id="custom-button" class="btn btn-primary">Fetch Location</button>');

	// Create a placeholder for the map
	document.querySelector('[data-fieldname="willingness_to_provide_at_least_05_ha_12_ac"]')
		.insertAdjacentHTML('beforeend', '<div id="map-container" style="margin-top: 10px;"></div>');

	// Add click event listener for the button
	document.getElementById('custom-button').addEventListener('click', function () {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function (position) {
				const latitude = position.coords.latitude;
				const longitude = position.coords.longitude;

				// Set latitude and longitude fields
				frappe.web_form.set_value('latitude', latitude);
				frappe.web_form.set_value('longitude', longitude);

				// Prepare GeoJSON object
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

				// Set farm_geocordinats field with GeoJSON
				frappe.web_form.set_value('farm_geocordinats', JSON.stringify(geoJSON));
				// console.log("GeoJSON set in farm_geocordinats:", JSON.stringify(geoJSON));

				// Display map in the placeholder
				const map_url = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
				const map_html = `
					<iframe width="100%" height="300" 
						src="${map_url}" frameborder="0" 
						style="border:0" allowfullscreen>
					</iframe>`;
				document.getElementById('map-container').innerHTML = map_html;
			}, function (error) {
				frappe.msgprint(__('Error fetching location: ' + error.message));
			});
		} else {
			frappe.msgprint(__('Geolocation is not supported by your browser.'));
		}
	});
});


// frappe.ready(function () {
// 	// Trigger when the "Country" field changes
// 	$('[data-fieldname="country"]').on('change', function () {
// 		let selected_country = $(this).val(); // Get selected country
// 		if (selected_country) {
// 			// Fetch states based on selected country
// 			frappe.call({
// 				method: 'lms.api.api.get_states_by_country',
// 				args: {
// 					doctype: 'State', // Replace with your Doctype name
// 					filters: { country: selected_country },
// 					fields: ['name'] // Fetch only the name field
// 				},
// 				callback: function (response) {
// 					if (response.message) {
// 						let state_field = $('[data-fieldname="state"]');
// 						state_field.empty(); // Clear existing options
// 						state_field.append('<option value="">Select State</option>'); // Default option
// 						response.message.forEach(function (state) {
// 							state_field.append('<option value="' + state.name + '">' + state.name + '</option>');
// 						});
// 					} else {
// 						console.log('No states found for country:', selected_country);
// 					}
// 				}
// 			});
// 		} else {
// 			$('[data-fieldname="state"]').empty().append('<option value="">Select State</option>'); // Reset states
// 			$('[data-fieldname="district"]').empty().append('<option value="">Select District</option>'); // Reset districts
// 		}
// 	});

// 	// Trigger when the "State" field changes
// 	$('[data-fieldname="state"]').on('change', function () {
// 		let selected_state = $(this).val(); // Get selected state
// 		if (selected_state) {
// 			// Fetch districts based on selected state
// 			frappe.call({
// 				method: 'lms..api.api.get_districts_by_state',
// 				args: {
// 					doctype: 'District', // Replace with your Doctype name
// 					filters: { state: selected_state },
// 					fields: ['name'] // Fetch only the name field
// 				},
// 				callback: function (response) {
// 					if (response.message) {
// 						let district_field = $('[data-fieldname="district"]');
// 						district_field.empty(); // Clear existing options
// 						district_field.append('<option value="">Select District</option>'); // Default option
// 						response.message.forEach(function (district) {
// 							district_field.append('<option value="' + district.name + '">' + district.name + '</option>');
// 						});
// 					} else {
// 						console.log('No districts found for state:', selected_state);
// 					}
// 				}
// 			});
// 		} else {
// 			$('[data-fieldname="district"]').empty().append('<option value="">Select District</option>'); // Reset districts
// 		}
// 	});
// });
