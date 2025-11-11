#!/bin/bash

# Simplified Railway startup script for Frappe LMS

set -e

# Set default values
export FRAPPE_SITE_NAME_HEADER=${FRAPPE_SITE_NAME_HEADER:-$RAILWAY_PUBLIC_DOMAIN}
export PORT=${PORT:-8000}

echo "Starting Frappe LMS setup for Railway..."
echo "Site name: ${FRAPPE_SITE_NAME_HEADER}"
echo "Port: ${PORT}"

# Change to bench directory
cd /home/frappe/frappe-bench

# Set site name
SITE_NAME=${FRAPPE_SITE_NAME_HEADER:-"lms.railway.app"}
echo "Using site name: $SITE_NAME"

# Wait for database
if [ ! -z "$DATABASE_URL" ]; then
    echo "Waiting for database connection..."
    python3 -c "
import os
import time
import psycopg2
from urllib.parse import urlparse

url = urlparse(os.environ['DATABASE_URL'])
print(f'Connecting to database: {url.hostname}:{url.port}/{url.path[1:]}')

for i in range(30):
    try:
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port,
        )
        conn.close()
        print('Database connection successful!')
        break
    except Exception as e:
        print(f'Waiting for database... ({i+1}/30): {e}')
        time.sleep(2)
else:
    raise Exception('Database connection failed')
"
fi

# Use existing configuration or create minimal one
if [ ! -f "sites/common_site_config.json" ]; then
    echo "Creating minimal configuration..."
    mkdir -p sites
    cat > sites/common_site_config.json << EOF
{
  "db_type": "postgres",
  "developer_mode": 0,
  "disable_website_cache": 1,
  "allow_tests": 0,
  "enable_scheduler": 0
}
EOF
fi

# Use a simple site name if none exists
if [ ! -d "sites/$SITE_NAME" ] && [ -z "$(ls -A sites/ 2>/dev/null | grep -v common_site_config.json | grep -v apps.txt | head -1)" ]; then
    echo "No existing site found. Using development setup..."
    SITE_NAME="development.localhost"
fi

# Find existing site or create new one
EXISTING_SITE=$(ls -d sites/*/ 2>/dev/null | grep -v __pycache__ | head -1 | sed 's|sites/||' | sed 's|/$||' || echo "")

if [ ! -z "$EXISTING_SITE" ] && [ "$EXISTING_SITE" != "__pycache__" ]; then
    echo "Found existing site: $EXISTING_SITE"
    SITE_NAME=$EXISTING_SITE
    echo $SITE_NAME > sites/currentsite.txt
else
    echo "Creating new development site..."
    # Create a simple development site
    SITE_NAME="development.localhost"
    mkdir -p "sites/$SITE_NAME"
    
    # Create basic site config
    cat > "sites/$SITE_NAME/site_config.json" << EOF
{
  "db_type": "postgres",
  "developer_mode": 0
}
EOF
    
    echo $SITE_NAME > sites/currentsite.txt
fi

echo "Using site: $SITE_NAME"

# Set up basic site structure if needed
mkdir -p "sites/$SITE_NAME/locks"
mkdir -p "sites/$SITE_NAME/private/backups"
mkdir -p "sites/$SITE_NAME/public/files"

# Ensure apps.txt exists
if [ ! -f "sites/apps.txt" ]; then
    echo "frappe" > sites/apps.txt
    echo "lms" >> sites/apps.txt
fi

# Start the application in development mode
echo "Starting Frappe LMS on port $PORT..."
echo "Access your app at: http://localhost:$PORT"

# Use bench start for development
export FRAPPE_SITE=$SITE_NAME

# Start with minimal services
exec python3 -c "
import os
os.chdir('/home/frappe/frappe-bench')
os.environ['FRAPPE_SITE'] = '$SITE_NAME'
from frappe.utils.bench_helper import main
import sys
sys.argv = ['bench', 'serve', '--port', '$PORT']
main()
"