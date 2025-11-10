#!/bin/bash

# Railway startup script for Frappe LMS

set -e

# Set default values
export FRAPPE_SITE_NAME_HEADER=${FRAPPE_SITE_NAME_HEADER:-$RAILWAY_PUBLIC_DOMAIN}
export PORT=${PORT:-8000}

echo "Starting Frappe LMS setup for Railway..."
echo "Site name: ${FRAPPE_SITE_NAME_HEADER}"
echo "Port: ${PORT}"

# Initialize bench if needed
if [ ! -f "sites/common_site_config.json" ]; then
    echo "Initializing bench..."
    bench init --skip-assets --python $(which python3) /home/frappe/frappe-bench
fi

# Wait for services if DATABASE_URL is provided
if [ ! -z "$DATABASE_URL" ]; then
    echo "Waiting for database connection..."
    # Simple connection test
    python3 -c "
import os
import time
import psycopg2
from urllib.parse import urlparse

url = urlparse(os.environ['DATABASE_URL'])
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
        print(f'Waiting for database... ({i+1}/30)')
        time.sleep(2)
else:
    raise Exception('Database connection failed')
"
fi

# Configure database and Redis
if [ ! -z "$DATABASE_URL" ]; then
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
    'auto_commit_on_many_writes': 1,
}

if os.environ.get('REDIS_URL'):
    redis_url = os.environ['REDIS_URL']
    config.update({
        'redis_cache': f'{redis_url}/0',
        'redis_queue': f'{redis_url}/1',
        'redis_socketio': f'{redis_url}/2',
    })

with open('sites/common_site_config.json', 'w') as f:
    json.dump(config, f, indent=2)

print('Configuration saved')
"
fi

# Set site name
SITE_NAME=${FRAPPE_SITE_NAME_HEADER:-"lms.railway.app"}

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "Creating site: $SITE_NAME"
    
    # Get apps
    echo "frappe" > sites/apps.txt
    echo "lms" >> sites/apps.txt
    
    # Create new site
    bench new-site $SITE_NAME \
        --admin-password admin \
        --verbose \
        --force \
        --install-app lms
    
    # Set as current site
    echo $SITE_NAME > sites/currentsite.txt
    
    echo "Site created successfully!"
else
    echo "Site $SITE_NAME already exists, running migrations..."
    bench --site $SITE_NAME migrate
fi

# Start the application
echo "Starting Frappe LMS on port $PORT..."
exec bench serve \
    --port $PORT \
    --host 0.0.0.0 \
    --disable-logging