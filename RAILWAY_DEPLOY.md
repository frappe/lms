# Deploy Frappe LMS to Railway

This guide will help you deploy Frappe LMS to Railway.

## Prerequisites

1. Railway account ([railway.app](https://railway.app))
2. GitHub repository with this code

## Deployment Steps

### Option 1: One-Click Deploy (Recommended)

1. Click this button to deploy:
   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/WaddySam/lms)

### Option 2: Manual Deployment

1. **Fork this repository** to your GitHub account

2. **Create a new Railway project:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked repository

3. **Add required services:**
   - **PostgreSQL Database**: Add PostgreSQL database service
   - **Redis**: Add Redis service
   - **Web Service**: Your main application (automatically detected)

4. **Configure environment variables:**
   ```
   PORT=8000
   DATABASE_URL=(automatically set by Railway)
   REDIS_URL=(automatically set by Railway)
   FRAPPE_SITE_NAME_HEADER=(automatically set to your Railway domain)
   ```

5. **Deploy:**
   - Railway will automatically build and deploy your application
   - The build process will take 5-10 minutes on first deployment

## Environment Variables

Railway will automatically set most environment variables, but you can customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for the web server | `8000` |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `REDIS_URL` | Redis connection string | Auto-set by Railway |
| `FRAPPE_SITE_NAME_HEADER` | Site domain name | Auto-set to Railway domain |

## Post-Deployment

1. **Access your application:**
   - Your app will be available at: `https://[your-app-name].railway.app`

2. **Default login credentials:**
   - Username: `Administrator`
   - Password: `admin`

3. **Create your first course:**
   - Navigate to `/lms` path
   - Start creating courses and content

## Troubleshooting

### Build Issues
- Check the Railway build logs for any errors
- Ensure all files are committed to your repository

### Database Connection Issues
- Verify PostgreSQL service is running
- Check environment variables are set correctly

### Site Access Issues
- Ensure `FRAPPE_SITE_NAME_HEADER` matches your Railway domain
- Check health check logs in Railway dashboard

## Custom Domain

To use a custom domain:

1. Add your domain in Railway project settings
2. Update `FRAPPE_SITE_NAME_HEADER` to your custom domain
3. Configure DNS records as specified by Railway

## Scaling

Railway automatically handles scaling, but you can:
- Upgrade to higher-tier plans for more resources
- Add horizontal replicas through Railway dashboard

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Frappe LMS Documentation: [docs.frappe.io/learning](https://docs.frappe.io/learning)
- Issues: Create an issue in this repository