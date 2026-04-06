# Splash Screen Implementation

## What's Been Added

I've successfully integrated a beautiful spiral animation splash screen for RepoRadar with the following components:

### 1. Spiral Animation Component
**Location:** `client/src/components/ui/spiral-animation.tsx`

- Full-screen animated spiral effect using GSAP
- 3000 particles with physics-based motion
- Smooth camera movement and rotation
- Optimized for performance with proper DPR handling
- Responsive to window resizing

### 2. Splash Screen Page
**Location:** `client/src/pages/splash.tsx`

- Displays the spiral animation as background
- Shows your RepoRadar logo in the center
- Animated "Enter" button that fades in after 2 seconds
- Smooth transitions and hover effects
- Navigates to the landing page when clicked

### 3. Updated Routing
**Location:** `client/src/App.tsx`

- Splash screen is now the default route (`/`)
- Landing page moved to `/landing`
- All other routes remain unchanged

## Setup Instructions

### 1. Add Your Logo
Place your RepoRadar logo image at:
```
client/public/logo.png
```

The logo should be:
- PNG format with transparent background (recommended)
- 512x512 pixels or larger
- The image you attached (with spiral and GitHub icon)

### 2. Dependencies Installed
```bash
npm install gsap
```

## How It Works

1. **User visits the app** → Sees splash screen with spiral animation
2. **After 2 seconds** → "Enter" button fades in
3. **User clicks "Enter"** → Navigates to landing page
4. **From landing page** → Normal app flow continues

## Customization Options

### Change Animation Duration
In `spiral-animation.tsx`, modify:
```typescript
duration: 15,  // Change this value (in seconds)
```

### Change Button Fade-In Time
In `splash.tsx`, modify:
```typescript
setTimeout(() => {
  setStartVisible(true)
}, 2000)  // Change this value (in milliseconds)
```

### Change Navigation Target
In `splash.tsx`, modify:
```typescript
const enterApp = () => {
  setLocation('/landing')  // Change to any route
}
```

### Customize Button Style
The button uses Tailwind classes and can be easily customized in `splash.tsx`

## Testing

Run the development server:
```bash
npm run dev
```

Then visit `http://localhost:5000` to see the splash screen in action.

## Performance Notes

- The animation uses hardware acceleration via GSAP
- Canvas rendering is optimized for high DPI displays
- Animation automatically cleans up on unmount
- Responsive to window resizing without performance issues

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Works on mobile and desktop devices
