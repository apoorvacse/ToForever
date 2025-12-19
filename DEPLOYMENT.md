# Deployment Guide - Render.com

This guide explains how to deploy the Watch Together application on Render.com.

## Prerequisites

- Render.com account
- Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### 1. Backend Server Deployment

1. **Create a new Web Service on Render:**
   - Go to Render Dashboard → New → Web Service
   - Connect your Git repository
   - Configure the service:
     - **Name**: `watch-together-server`
     - **Environment**: `Node`
     - **Build Command**: `cd server && npm install`
     - **Start Command**: `cd server && npm start`
     - **Plan**: Starter (or higher)

2. **Set Environment Variables:**
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render automatically sets this, but good to have)
   - `FRONTEND_URL`: Your frontend URL (set after frontend deployment)

3. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the service URL (e.g., `https://watch-together-server.onrender.com`)

### 2. Frontend Deployment

1. **Create a new Static Site on Render:**
   - Go to Render Dashboard → New → Static Site
   - Connect your Git repository
   - Configure the site:
     - **Name**: `watch-together-client`
     - **Build Command**: `cd client && npm install && npm run build`
     - **Publish Directory**: `client/dist`

2. **Set Environment Variables:**
   - `VITE_SOCKET_URL`: Your backend server URL (from step 1)
     - Example: `https://watch-together-server.onrender.com`

3. **Deploy:**
   - Click "Create Static Site"
   - Wait for deployment to complete
   - Note the site URL

### 3. Update Backend CORS

After frontend is deployed, update the backend `FRONTEND_URL` environment variable:
- Go to Backend Service → Environment
- Update `FRONTEND_URL` to your frontend URL
- Redeploy if needed

## Environment Variables Reference

### Backend (`server/`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `10000` (Render default) |
| `FRONTEND_URL` | Frontend URL for CORS | `https://watch-together-client.onrender.com` |

### Frontend (`client/`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SOCKET_URL` | Backend server URL | `https://watch-together-server.onrender.com` |

## Using render.yaml (Alternative)

If you prefer using Render Blueprint:

1. Push `render.yaml` to your repository
2. Go to Render Dashboard → New → Blueprint
3. Connect your repository
4. Render will automatically detect and create services

## Post-Deployment

1. **Test the deployment:**
   - Visit your frontend URL
   - Create a room
   - Test with two browser windows

2. **Monitor:**
   - Check Render logs for any errors
   - Monitor service health via `/health` endpoint

3. **Troubleshooting:**
   - Check CORS settings if connection fails
   - Verify environment variables are set correctly
   - Check Render logs for detailed error messages

## Production Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] CORS configured correctly
- [ ] Health check endpoint working
- [ ] Socket.IO connection working
- [ ] WebRTC connection working
- [ ] No console errors in production

## Notes

- Render provides free SSL certificates automatically
- Services may spin down after inactivity (free tier)
- Consider upgrading to paid plan for always-on services
- Monitor usage to avoid exceeding free tier limits

