# Local Setup Instructions for Frappe LMS

To set up the Frappe LMS repository locally, please follow the detailed steps below:

## 1. Install Frappe Bench

Install bench and set up a `frappe-bench` directory by following the [Installation Steps](https://frappeframework.com/docs/user/en/installation).

## 2. Start the Frappe Server

Start the server by running:

```bash
bench start
```

## 3. Create a New Site

In a separate terminal window, create a new site for your local development:

```bash
bench new-site lms.test
```

## 4. Fork the LMS Repository

Fork the LMS app repository on GitHub to your account.

## 5. Get the LMS App

Clone your forked repository into the Frappe bench environment:

```bash
bench get-app <url-of-your-fork>
```

## 6. Install the LMS App

Install the LMS app onto your new site:

```bash
bench --site lms.test install-app lms
```

## 7. Map Your Site to Localhost

Map your new site to localhost to easily access it via a browser:

```bash
bench --site lms.test add-to-hosts
```

## 8. Access Your Site

Now, open the URL `http://lms.test:8000/` in your browser to see the LMS application running.

Follow these steps meticulously to ensure a successful setup of Frappe LMS for local development.