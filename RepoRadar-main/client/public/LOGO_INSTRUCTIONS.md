# Logo Setup Instructions

To complete the splash screen setup, please add your RepoRadar logo:

1. Save your logo image (the one with the spiral and GitHub icon) as `logo.png` in this directory (`client/public/`)
2. The recommended size is 512x512 pixels or larger for best quality
3. The image should be in PNG format with a transparent background for best results

The splash screen will automatically display your logo in the center with the spiral animation behind it.

If you want to use a different filename or format, update the image source in:
`client/src/pages/splash.tsx` (line with `src="/logo.png"`)
