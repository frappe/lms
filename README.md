<p align="center">
    <a href="https://github.com/frappe/lms/commits/main">
    <img src="https://img.shields.io/github/last-commit/frappe/lms.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub last commit">
    <a href="https://github.com/frappe/lms/issues">
    <img src="https://img.shields.io/github/issues-raw/frappe/lms.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub issues">
    <a href="https://github.com/frappe/lms/pulls">
    <img src="https://img.shields.io/github/issues-pr-raw/frappe/lms.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub pull requests">
     <a href="https://github.com/frappe/lms/license">
    <img src="https://img.shields.io/github/license/frappe/lms.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub pull requests">
</p>

<div align="center">
  <a href="https://www.frappelms.com/">
    <img src="https://www.frappelms.com/files/flms.svg" alt="Frappe LMS" width="80" height="80">
  </a>
  <h3 align="center">Frappe LMS</h3>
  <p align="center">
    Easy to Use, Open Source Learning Management System
    <br/>
    <a href="https://www.frappelms.com"><strong>Visit the website »</strong></a>
    <br/>
    <br/>
    <a href="https://www.frappelms.com/introduction">Explore the docs</a>.
    <a href="https://github.com/frappe/lms/issues">Report Bug</a>

  </p>

</div>

<!-- ABOUT THE PROJECT -->

## About The Project

![Frappe LMS](/lms/public/images/course-home.png)

Frappe LMS is an easy-to-use, open-source learning management system. It has a clear UI that helps students focus only on what's important and assists in distraction-free learning.

You can create courses and lessons through simple forms in the backend that you can analyze with the help of reports. Course Instructors and students can reach out to each other through the discussions section available for each lesson and get queries resolved.

Lessons can be in the form of text, videos, quizzes or a combination of all these. You can keep your students engaged with quizzes to help revise and test the concepts learned.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

Frappe LMS app is built using [Frappe Framework](https://frappeframework.com).

### Direct installation through bench

To setup the repository locally, follow the steps mentioned below:

1.  Install bench and set up a frappe-bench directory by following the  [Installation Steps](https://frappeframework.com/docs/user/en/installation).

2.  Start the server by running ```bench start```.

3.  In a separate terminal window, create a new site by running ```bench new-site lms.test```.

4.  Fork the Frappe LMS app and clone it.

5.  Run ```bench get-app lms``` to get the app on your bench.

6.  Run ```bench --site lms.test install-app lms```.

7.  Map your site to localhost with the command  ```bench --site lms.test add-to-hosts```.

8.  Now open the URL  [http://lms.test:8000/](http://lms.test:8000/)  in your browser, you should see the app running.

<p align="right">(<a href="#top">back to top</a>)</p>

### Installation through Docker

1. Clone the repo.

```

$ git clone https://github.com/frappe/lms.git

$ cd lms

```

2. Run docker-compose

```

$ docker-compose up

```

3. Visit the website at  [http://localhost:8000/](http://localhost:8000/)

You'll have to go through the setup wizard to set up the website the first time you access it. Log in using the following credentials to complete the setup wizard.

```

Username: Administrator

password: admin

```

## [](https://github.com/frappe/lms/blob/main/docker-installation.md#stopping-the-server)Stopping the server

Press  ctrl+c  in the terminal to stop the server. You can also run  docker-compose down  in another terminal to stop it.

To completely reset the instance, do the following:

```

$ docker-compose down --volumes

$ docker-compose up

```

<!-- CONTRIBUTING -->

## Contributing

Contributions are what makes the open source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Thank you for your interest in contributing to an open-source project! Our world works on people taking initiative to contribute to the "commons" and contributing to open source means you are contributing to making things better for not only yourself but everyone else too! So thank you for taking this initiative.

Great projects also work because of great quality. Open source or not, the user really cares that things should work as they are advertised, and consistently. New features should follow the same pattern so that users don't have to learn things again and again.

Developers who maintain open source also expect that you follow certain guidelines. These guidelines ensure that developers are able to quickly give feedback on your contribution and how to make it better. Most probably you might have to go back and change a few things, but it will be in the interest of making this process better for everyone. So be prepared for some back and forth.

Don't forget to give the project a star! Thanks again!

1.  Go to the apps/lms directory of your installation and execute git pull --unshallow to ensure that you have the full git repository. Also, fork the frappe/lms repository on GitHub.

2.  Check out a working branch in git (e.g. ```git checkout -b my-new-branch```).

3.  Run your local version (e.g. bench start in your bench installation). Make sure that your changes work the way you want them to.

4.  Commit your changes to your branch. Make sure to use a semantic commit message.

6.  Push your branch to your fork on Github, and create a pull request.

<p align="right">(<a href="#top">back to top</a>)</p>

## License

Distributed under [GNU AFFERO GENERAL PUBLIC LICENSE](license.txt)
