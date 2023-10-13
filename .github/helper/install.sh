#!/bin/bash
set -e
cd ~ || exit

sudo apt update
sudo apt remove mysql-server mysql-client
sudo apt install libcups2-dev redis-server mariadb-client-10.6

echo "Setting Up Bench..."

pip install frappe-bench
bench -v init frappe-bench --skip-assets --python "$(which python)"
cd ./frappe-bench || exit

bench -v setup requirements

echo "Setting Up LMS App..."
bench get-app lms "${GITHUB_WORKSPACE}"

echo "Setting Up Sites & Database..."

mkdir ~/frappe-bench/sites/lms.test
cp "${GITHUB_WORKSPACE}/.github/helper/site_config.json" ~/frappe-bench/sites/lms.test/site_config.json


mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL character_set_server = 'utf8mb4'";
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'";

mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "CREATE DATABASE test_lms";
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "CREATE USER 'test_lms'@'localhost' IDENTIFIED BY 'test_lms'";
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "GRANT ALL PRIVILEGES ON \`test_lms\`.* TO 'test_lms'@'localhost'";

mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "FLUSH PRIVILEGES";

cd ~/frappe-bench || exit

echo "Setting Up Procfile..."

sed -i 's/^watch:/# watch:/g' Procfile
sed -i 's/^schedule:/# schedule:/g' Procfile

echo "Starting Bench..."

bench start &> bench_start.log &
CI=Yes bench build &
bench --site lms.test reinstall --yes

bench get-app hrms

bench --site lms.test install-app lms
bench setup requirements --dev
