<p align="center">
  <a href="https://www.frappelms.com/">
    <img src="https://frappe.io/files/lms.png" alt="Frappe LMS Logo" width="50px" height="50px">
  </a>
  <p align="center">A user-friendly, open-source Learning Management System.</p>
</p>

&nbsp;

<p align="center">
    <a href="https://www.producthunt.com/posts/frappe-lms?utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-frappe-lms" target="_blank">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-topic-badge.svg?post_id=396079&theme=dark&period=weekly&topic_id=204" alt="Product Hunt Badge" width="250" height="54">
    </a>
</p>

<div align="center">
    <a href="https://frappecloud.com/lms/signup">
        <img src=".github/try-on-f-cloud.svg" alt="Try on Frappe Cloud" height="40">
    </a>
</div>

&nbsp;

<p align="center">
	<a href="https://dashboard.cypress.io/projects/vandxn/runs">
    <img src="https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/vandxn/main&style=flat&logo=cypress" alt="Cypress Dashboard">
  </a>
  <a href="https://github.com/frappe/lms/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-blue" alt="License Badge">
  </a>
</p>

<img src="https://frappelms.com/files/banner.png" alt="Frappe LMS Banner" width="1402">

<details>
	<summary>Show more screenshots</summary>
	<img src="https://user-images.githubusercontent.com/31363128/210056046-584bc8aa-d28c-4514-b031-73817012837d.png" alt="Screenshot 1" width="1520">
	<img src="https://user-images.githubusercontent.com/31363128/210056097-36849182-6db0-43a2-8c62-5333cd2aedf4.png" alt="Screenshot 2" width="830">
	<img src="https://user-images.githubusercontent.com/31363128/210056134-01a7c429-1ef4-434e-9d43-128dda35d7e5.png" alt="Screenshot 3" width="941">
</details>

Frappe LMS is an intuitive, open-source Learning Management System designed to facilitate online education. It enables the creation and distribution of diverse course content, including text, videos, and quizzes. With a clean user interface, it ensures a focus on content, supporting distraction-free learning. Instructors and students can engage through lesson-specific discussions, enhancing the learning experience.

## Features
- 📚 Create and manage online courses.
- 🎬 Add rich media and descriptions to enhance course previews.
- 📝 Incorporate interactive elements like videos, quizzes, and assignments.
- 💬 Foster interaction through lesson-based discussion sections.
- 🏛 Organize students into batches for better course management.
- 📈 View critical statistics at a glance with a comprehensive dashboard.
- 💼 Explore employment opportunities with an integrated job board.
- 👨‍👩‍👧‍👦 Connect through a detailed people directory.
- 🦹🏼‍♀️ Customize profiles with photos, bios, and more.
- 🤓 Enjoy a simple layout optimized for ease of use and readability.
- ✨ Experience a delightful and intuitive user interface.

## Tech Stack

Built on the robust [Frappe Framework](https://frappeframework.com), a full-featured python web framework, Frappe LMS leverages:
- [Python](https://www.python.org)
- [Redis](https://redis.io/)
- [MariaDB](https://mariadb.org/)
- [Socket.io](https://socket.io/)

## Local Setup

### Docker
Ensure you have Docker, docker-compose, and git installed. Follow the [Docker documentation](https://docs.docker.com/). To set up, execute:
```
git clone https://github.com/frappe/lms
cd apps/lms/docker
docker-compose up
```
After the setup script completes, access the app at `http://localhost:8000`.

### Frappe Bench

This application relies on the `develop` branch of [Frappe](https://github.com/frappe/frappe). Set up Frappe Bench using [this guide](https://frappeframework.com/docs/v14/user/en/installation).

 Then:
```sh
cd frappe-bench
bench start
# In a new terminal
bench new-site lms.test
bench get-app lms
bench --site lms.test install-app lms
bench --site lms.test add-to-hosts
```
Access your site at `http://lms.test:8000`.

## Deployment

Deploy on [Frappe Cloud](https://frappecloud.com/marketplace/apps/lms) with a few clicks or follow the [Frappe Bench Installation](https://github.com/frappe/bench#installation) for self-hosting.

## Bugs and Feature Requests

Report bugs and suggest features via [GitHub Issues](https://github.com/frappe/lms/issues). Please provide comprehensive information to assist the maintainers.

## License

Frappe LMS is distributed under the [GNU AFFERO GENERAL PUBLIC LICENSE](license.txt).