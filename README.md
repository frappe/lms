## Community

This app helps people organize and manage their own communities.

The App has following components:

1. Hackathons
1. LMS

Community is built on the [Frappe Framework](https://github.com/frappe/frappe), a full-stack web app framework built with Python & JavaScript.

## Development Setup

**Step 1:** Clone the repo

```
$ git clone https://github.com/fossunited/community.git

$ cd community
```

**Step 2:** Run docker-compose

```
$ docker-compose up
```

**Step 3:** Visit the website at http://localhost:8000/

You'll have to go through the setup wizard to setup the website for the first time you access it. Login using the following credentiasl to complete the setup wizard.

```
Username: Administrator
password: admin
```

TODO: Explain how to load sample data

## Stopping the server

Press `ctrl+c` in the terminal to stop the server. You can also run `docker-compose down` in another terminal to stop it.

To completely reset the instance, do the following:

```
$ docker-compose down --volumes
$ docker-compose up
```

## Making Code Changes

The dev setup is configured to reload whenever any code is changed. Just edit the code and reload the webpage.

Commit the changes in a branch and send a pull request.

## Local Setup - The Hard Way

To setup the repository locally follow the steps mentioned below:

1. Install bench and setup a frappe-bench directory by following the [Installation Steps](https://frappeframework.com/docs/user/en/installation).
1. Start the server by running bench start.
1. In a separate terminal window, create a new site by running bench new-site community.test.
1. Run bench get-app https://github.com/fossunited/community.
1. Run bench --site community.test install-app community.
1. Map your site to localhost with the command ```bench --site community.test add-to-hosts```
1. Now open the URL http://community.test:8000/docs in your browser, you should see the app running.

### Contribution Guidelines (for The Hard Way)

1. Go to the apps/community directory of your installation and execute git pull --unshallow to ensure that you have the full git repository. Also fork the fossunited/community repository on GitHub.
1. Check out a working branch in git (e.g. git checkout -b my-new-branch).
1. Make your proposed changes to the source
1. Run your local version (e.g. bench start in your bench installation). Make sure that your changes work the way you want them to.
1. Commit your changes to your branch. Make sure to use a semantic commit message.
1. Push your branch to your fork on Github, and issue a pull request.

#### License

AGPL
