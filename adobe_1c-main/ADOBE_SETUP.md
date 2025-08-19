# Adobe PDF Embed API Setup Guide

To use the Adobe PDF Embed API, you need to get a Client ID from Adobe Developer Console.

## Step 1: Get Adobe PDF Embed API Credentials

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Sign in with your Adobe ID (create one if needed)
3. Click "Create new project"
4. Add the "PDF Embed API" to your project
5. Configure the API:
   - **Allowed domains**: Add `localhost:3000` for development
   - **Name**: Choose a name for your app
6. Copy your **Client ID** from the credentials section

## Step 2: Update the Client ID

1. Open `frontend/src/PDFViewer.js`
2. Find the line: `const CLIENT_ID = "YOUR_ADOBE_CLIENT_ID";`
3. Replace `"YOUR_ADOBE_CLIENT_ID"` with your actual Client ID

Example:
```javascript
const CLIENT_ID = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
```

## Step 3: Production Configuration

For production deployment:
1. Add your production domain to the "Allowed domains" in Adobe Developer Console
2. Update the domain in your application settings

## Features Available

With Adobe PDF Embed API, you get:
- ✅ Professional PDF viewer
- ✅ Zoom, pan, and navigation controls
- ✅ Annotation tools
- ✅ Search functionality
- ✅ Print and download options
- ✅ Mobile-responsive design
- ✅ Secure viewing (no direct file access)

## Alternative: Without Adobe API

If you prefer not to use Adobe's API, the application includes a fallback iframe viewer that works with any PDF URL. This provides basic PDF viewing functionality without requiring API credentials.

## Troubleshooting

- **PDF not loading**: Check that your Client ID is correct and the domain is whitelisted
- **CORS errors**: Ensure your domain is added to the Adobe Developer Console
- **API limits**: Free tier has usage limits; check Adobe's pricing for higher usage

For more details, visit the [Adobe PDF Embed API documentation](https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/).
