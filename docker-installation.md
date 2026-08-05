**Step 1:** Clone the repo

```
$ git clone https://github.com/frappe/lms.git

$ cd lms

$ cd docker
```

**Step 2:** Run docker-compose

```
$ docker-compose up
```

**Step 3:** Visit the website at http://localhost:8000/

You'll have to go through the setup wizard to setup the website for the first time you access it. Login using the following credentials to complete the setup wizard.

```
Username: Administrator
password: admin
```

These credentials are intended for local development only. Change the administrator password before using the site outside a local test environment.

## Loading demo data

The LMS app creates demo data when the setup wizard completes. If you need to recreate the demo course after clearing it, run the following command from another terminal while the Docker services are running:

```
$ docker-compose exec frappe bash -lc "cd frappe-bench && bench --site lms.localhost execute lms.demo.demo_data.create_demo_data"
```

This creates the sample course, instructor, learners, lessons, quizzes, and progress records used for local evaluation. To remove the demo course later, open the user menu in the LMS interface and choose **Clear Demo Data**.

## Stopping the server

Press `ctrl+c` in the terminal to stop the server. You can also run `docker-compose down` in another terminal to stop it.

To completely reset the instance, do the following:

```
$ docker-compose down --volumes
$ docker-compose up
```
