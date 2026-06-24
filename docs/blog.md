# Sanvasify Blog Deployment Plan

This document outlines the final plan to build, structure, and deploy the blog at [blog.sanvasify.com](https://blog.sanvasify.com) using **Cloudflare Pages**.

---

## 1. Project Structure

To keep the blog codebase clean and separated from the main Go application, we will organize the blog files in a dedicated `/blog` directory at the root of the repository.

```
sanvasify/ (repository root)
├── blog/                      # Dedicated blog folder (Cloudflare Pages Root)
│   ├── index.html            # Blog homepage (lists articles)
│   ├── posts/                # Individual blog posts
│   │   ├── first-post.html
│   │   └── index.html        # Redirect or list for posts directory
│   ├── css/                  # Modern, premium styling
│   │   └── style.css
│   ├── js/                   # Clientside interactivity
│   │   └── main.js
│   ├── assets/               # Images, fonts, and media
│   │   └── logo.png
│   ├── _headers              # Cloudflare custom HTTP headers
│   └── _redirects            # Cloudflare redirects mapping
├── cmd/                      # (Existing Go Backend)
├── web/                      # (Existing Main Frontend)
└── docs/                     # Documentation
```

---

## 2. Technical Stack

To maintain simplicity, high performance, and zero-cost scaling:
* **Frontend**: HTML5, Vanilla CSS3 (Custom properties, grid/flexbox layout, fluid typography, dark/light mode toggle), and modern ES Modules JavaScript.
* **Build System**: None (Direct static hosting, no compile step needed).
* **Hosting**: Cloudflare Pages (integrated with the GitHub repository).
* **SSL/TLS & CDN**: Automatically managed by Cloudflare.

---

## 3. Step-by-Step Deployment Guide

### Step 3.1: Prepare the Blog Directory Local Files
1. Create the `blog/` directory structure in the root of the project.
2. Initialize a base `index.html` with modern semantic HTML and responsive viewport settings.
3. Add a premium `css/style.css` defining the design system (e.g., CSS variables, Inter/System font stack, elegant spacing, subtle hover states).
4. Save custom configuration files like `_headers` to define cache control policies and security headers (e.g., `X-Frame-Options`, `Content-Security-Policy`).

### Step 3.2: Connect Repository to Cloudflare Pages
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** -> click **Create Application** -> select the **Pages** tab.
3. Click **Connect to Git** and authorize your GitHub account.
4. Select the `raghavkgarg/sanvasify` repository.
5. Configure the **Build Settings**:
   * **Project Name**: `sanvasify-blog`
   * **Production branch**: `main`
   * **Framework preset**: `None`
   * **Build command**: *Leave empty*
   * **Root directory**: `/blog` (This ensures Cloudflare only deploys files inside the `/blog` folder, ignoring the rest of the Go app code)
6. Click **Save and Deploy**. Cloudflare will build the first version of your static blog.

### Step 3.3: Set Up the Custom Subdomain
1. Once the deployment finishes, go to your new Cloudflare Pages project page.
2. Navigate to the **Custom Domains** tab.
3. Click **Set up a custom domain**.
4. Enter `blog.sanvasify.com` and click **Continue**.
5. If your parent domain `sanvasify.com` is already configured in your Cloudflare account, Cloudflare will automatically offer to create the DNS CNAME record for you. Click **Activate domain**.
6. Cloudflare will automatically provision an SSL/TLS certificate for your subdomain. Within a few minutes, the site will be live at `https://blog.sanvasify.com`.

---

## 4. Performance & SEO Best Practices

To ensure a premium user experience and high search visibility, we will implement the following:

### SEO Essentials
* **Metadata**: Every HTML file will include descriptive `<title>` tags and `<meta name="description">` tags.
* **Canonical Tags**: Specify `<link rel="canonical" href="...">` to prevent duplicate content issues.
* **Open Graph (OG)**: Include OG tags (`og:title`, `og:description`, `og:image`) for preview generation when sharing on social media.
* **Structured Data**: JSON-LD schema markup on post pages for Google Rich Snippets support.
* **Sitemap & Robots**: Maintain `/blog/sitemap.xml` and `/blog/robots.txt` mapped correctly.

### Performance & Cache Optimization
* **Lazy Loading**: Use `loading="lazy"` on all images.
* **Modern Formats**: Convert blog images to modern web formats (WebP or AVIF).
* **Caching Strategy**: Add the following cache directives to `/blog/_headers`:
  ```http
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  /css/*
    Cache-Control: public, max-age=31536000, immutable
  /js/*
    Cache-Control: public, max-age=31536000, immutable
  ```