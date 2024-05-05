# Docker Installation Guide

## Setting Up Docker on Your System

#### Abstract

This README.md serves as the comprehensive guide for setting up and using the Dockerized Learning Management System (LMS) provided by Frappe. The Dockerized LMS is designed for simplicity and efficiency, allowing users to deploy and manage an open-source LMS with minimal setup. The guide outlines the process of installing Docker, setting up the LMS application, and accessing the system via a local server. It caters to users looking for a flexible learning solution that supports various educational content types, including videos, quizzes, and interactive discussions. Additionally, the document provides links to further setup instructions and deployment options, ensuring users can adapt the system to their specific needs, whether on managed hosting platforms like Frappe Cloud or through self-hosting. This document is essential for educators, developers, and IT professionals leveraging Frappe LMS's capabilities for educational purposes or personal growth.

### Step 1: Clone the repository

```bash
git clone https://github.com/frappe/lms.git
cd lms/docker
```

### Step 2: Start the Docker containers

```bash
docker compose up
```

### Step 2.5 (Optional): Keep the application running in the background

To run the Docker containers in detached mode (in the background), use the following command instead of the one in Step 2:

```bash
docker compose up -d
```

### Step 3: Access the application

Visit the website at http://localhost:8000/

You must complete the setup wizard the first time you access the website. Use the following credentials to log in and complete the setup wizard:

```
Username: Administrator
Password: admin
```

### TODO: Explain how to load sample data.

## Stopping the server

To stop the server, press `CTRL+C` in the terminal where the server is running. Alternatively, you can run the following command in another terminal to stop all Docker containers:

```bash
docker compose down
```

To completely reset the instance, including all data volumes, run:

```bash
docker compose down --volumes
docker compose up
```
