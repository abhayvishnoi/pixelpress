# Pixel Press

Pixel Press is a private, browser-based batch image tool built with Angular. Add
one logo or watermark to up to 30 images, choose its placement, size, and
opacity, then export the results as PNG, JPG, or WebP. Image processing happens
locally in the browser; files are not uploaded to a server.

## Requirements

- Node.js and npm compatible with the Angular CLI version in `package.json`

## Run locally

```sh
npm install
npm start
```

Open the local URL printed by Angular CLI (usually `http://localhost:4200`).

## Use the image studio

1. Choose a logo or watermark image. A transparent PNG is a good choice.
2. Add up to 30 source images by browsing or dragging them into the batch.
3. Set the overlay position, relative size, and opacity.
4. Choose an output format. JPG and WebP include an adjustable quality setting.
5. Process the batch and download each completed image from its preview card.

The output keeps each source image's dimensions. Failed images show an error
beside the affected card and do not prevent the rest of the batch from finishing.

## Build and test

```sh
npm run build
npm test -- --watch=false
```

The app uses the browser Canvas API and Angular forms; it requires no image
processing server or third-party runtime service.

## Deploy to GitHub Pages

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` builds the
Angular app with the repository name as its base path, enables GitHub Pages if
needed, and publishes it whenever changes are pushed to `main` or `master`. If
your repository policy prevents automatic Pages enablement, select
**GitHub Actions** as the deployment source in **Settings → Pages**.
