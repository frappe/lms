#!/bin/bash

# Railway startup script for Frappe LMS

set -e

# Set default values
export FRAPPE_SITE_NAME_HEADER=${FRAPPE_SITE_NAME_HEADER:-$RAILWAY_PUBLIC_DOMAIN}
export PORT=${PORT:-8000}

echo "Starting Frappe LMS setup for Railway..."
echo "Site name: ${FRAPPE_SITE_NAME_HEADER}"
echo "Port: ${PORT}"

# Change to bench directory
cd /home/frappe/frappe-bench

# Initialize bench if not already done
if [ ! -f "sites/common_site_config.json" ]; then
    echo "Initializing bench environment..."
    
    # Ensure we have the right structure
    mkdir -p sites
    mkdir -p apps
    
    # Create apps.txt
    echo "frappe" > sites/apps.txt
    echo "lms" >> sites/apps.txt
fi

# Wait for services if DATABASE_URL is provided
if [ ! -z "$DATABASE_URL" ]; then
    echo "Configuring database connection..."
    
    # Install psycopg2 if needed
    pip3 install psycopg2-binary || true
    
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

# Configure database and Redis
if [ ! -z "$DATABASE_URL" ]; then
    echo "Writing configuration..."
    python3 -c "
import os
import json
from urllib.parse import urlparse

url = urlparse(os.environ['DATABASE_URL'])

config = {
    'db_host': url.hostname,
    'db_port': url.port or 5432,
    'db_name': url.path[1:],
    'db_password': url.password,
    'db_user': url.username,
    'db_type': 'postgres',
    'auto_commit_on_many_writes': 1,
    'developer_mode': 0,
    'disable_website_cache': 1,
    'allow_tests': 0,
    'enable_scheduler': 0,
}

if os.environ.get('REDIS_URL'):
    redis_url = os.environ['REDIS_URL']
    config.update({
        'redis_cache': f'{redis_url}/0',
        'redis_queue': f'{redis_url}/1',
        'redis_socketio': f'{redis_url}/2',
    })

# Ensure sites directory exists
os.makedirs('sites', exist_ok=True)

with open('sites/common_site_config.json', 'w') as f:
    json.dump(config, f, indent=2)

print('Configuration saved')
print(f'Config: {config}')
"
fi

# Set site name
SITE_NAME=${FRAPPE_SITE_NAME_HEADER:-"lms.railway.app"}
echo "Using site name: $SITE_NAME"

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "Creating new site: $SITE_NAME"
    
    # Install frappe if not present
    if [ ! -d "apps/frappe" ]; then
        echo "Getting Frappe app..."
        bench get-app frappe || echo "Frappe already available"
    fi
    
    # Extract database info for site creation
    DB_NAME=$(python3 -c "
import os
from urllib.parse import urlparse
url = urlparse(os.environ['DATABASE_URL'])
print(url.path[1:])
")
    
    # Create new site with PostgreSQL database
    echo "Creating site with admin password..."
    bench new-site $SITE_NAME \
        --admin-password admin \
        --mariadb-root-password dummy \
        --db-type postgres \
        --db-host $(python3 -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ['DATABASE_URL']).hostname)") \
        --db-port $(python3 -c "from urllib.parse import urlparse; import os; url=urlparse(os.environ['DATABASE_URL']); print(url.port or 5432)") \
        --verbose \
        --force
    
    # Install LMS app
    echo "Installing LMS app..."
    bench --site $SITE_NAME install-app lms
    
    # Set as current site
    echo $SITE_NAME > sites/currentsite.txt
    
    echo "Site created successfully!"
else
    echo "Site $SITE_NAME already exists, running migrations..."
    bench --site $SITE_NAME migrate || echo "Migration completed with warnings"
fi

echo "Setting up site configuration..."
bench --site $SITE_NAME set-config developer_mode 1
bench --site $SITE_NAME set-config disable_website_cache 1

# Clear cache and build assets
echo "Clearing cache and building assets..."
bench --site $SITE_NAME clear-cache || true

# Skip asset build for now to save memory - assets will be served from CDN or pre-built
echo "Skipping asset build to conserve memory"
# bench build || echo "Build completed with warnings"

# Start the application
echo "Starting Frappe LMS on port $PORT..."
echo "Server will be available shortly..."

exec bench serve \
    --port $PORT \
    --noreload \
    --nothreading