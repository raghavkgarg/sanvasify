# Sanvasify Blog Deployment Plan (Hugo-Powered)

This document outlines the structure, local development workflow, and deployment plan for the blog at [blog.sanvasify.com](https://blog.sanvasify.com) using **Hugo** and **Cloudflare Pages**.

---

## 1. Project Structure

To keep the blog codebase clean, dynamic, and separated from the main Go application, the blog is managed as a self-contained Hugo project in the `/blog` directory at the root of the repository. Unnecessary default folders like `themes/`, `data/`, and `i18n/` have been removed to keep the setup minimal.

```
sanvasify/ (repository root)
├── blog/                      # Dedicated blog folder (Hugo Project root)
│   ├── hugo.toml             # Hugo configuration file (site-wide settings)
│   ├── assets/               # SOURCE assets for HUGO PROCESSING (e.g., resizing, WebP conversion)
│   │   └── images/
│   │       └── india-smr-strategy.png
│   ├── content/              # SOURCE content files (written in Markdown)
│   │   └── posts/
│   │       ├── demystifying-sifs.md
│   │       └── india-rare-earth-monopoly.md
│   ├── layouts/              # SOURCE HTML templates (defines page structures and designs)
│   │   ├── index.html        # Homepage layout
│   │   └── _default/
│   │       ├── list.html     # Fallback list layout
│   │       └── single.html   # Post details layout
│   ├── static/               # SOURCE static assets (copied exactly as-is to the build output)
│   │   ├── css/              # Source style.css (edit this to change styling)
│   │   ├── js/               # Source main.js (edit this to change interactivity)
│   │   ├── assets/           # Static images (served raw, no processing)
│   │   ├── _headers          # Cloudflare headers config
│   │   ├── _redirects         # Cloudflare redirects config
│   │   └── robots.txt
│   ├── public/               # DYNAMIC BUILD OUTPUT (auto-generated, IGNORED by Git)
│   │                         # This is the compiled website containing all HTML, CSS, and JS.
│   └── resources/            # DYNAMIC BUILD CACHE (auto-generated, IGNORED by Git)
│                             # Used by Hugo to cache processed assets for ultra-fast builds.
├── cmd/                      # (Existing Go Backend)
├── web/                      # (Existing Main Frontend)
└── docs/                     # Documentation
```

### Understanding Hugo Folders: Source vs. Output
It is critical to distinguish between directories you edit (Source) and directories Hugo manages automatically (Output):

* **Source Folders (Edit these & Commit to Git)**:
  * **`/static`**: Contains assets copied verbatim to `/public` on build. Edit your active stylesheets (`static/css/style.css`) and script files here.
  * **`/assets`**: Raw images/resources that Hugo's pipelines process dynamically (e.g. resizing and converting PNG to WebP).
  * **`/content`**: Markdown files for your articles.
  * **`/layouts`**: HTML templates.
* **Auto-Generated Folders (Do NOT edit & Ignored by Git)**:
  * **`/public`**: The final compiled website directory. Hugo automatically copies compiled files from `/static` and `/assets` here during a build.
  * **`/resources`**: Temp cache folder for faster compilation speeds.

> [!NOTE]
> Local generated folders (`blog/public/`, `blog/resources/`, and `blog/.hugo_build.lock`) are ignored by Git in `.gitignore` and are built dynamically on deployment.

---

## 2. Technical Stack

* **Static Site Generator**: [Hugo](https://gohugo.io/) (Extended Version)
* **Frontend**: HTML5, Vanilla CSS3 (Custom properties, grid/flexbox layout, fluid typography, dark/light mode toggle), and modern ES Modules JavaScript.
* **Hosting**: Cloudflare Pages (integrated with the GitHub repository, building on git pushes).
* **SSL/TLS & CDN**: Automatically managed by Cloudflare.

---

## 3. Step-by-Step Deployment & Configuration Guide

### Step 3.1: Install Hugo Locally
On macOS:
```bash
brew install hugo
```

### Step 3.2: Configure Cloudflare Pages
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** -> click **Create Application** -> select the **Pages** tab.
3. Select your `raghavkgarg/sanvasify` repository.
4. Configure the **Build Settings**:
   * **Project Name**: `sanvasify-blog`
   * **Production branch**: `main`
   * **Framework preset**: `Hugo`
   * **Build command**: `hugo --gc --minify`
   * **Root directory**: `blog`
   * **Build output directory**: `public` (Note: because the Root Directory is set to `blog`, Cloudflare runs inside `blog/` and outputs to `blog/public`, so the build output directory relative to the root is `public`).
5. Click **Save and Deploy**.

---

## 4. Local Development Workflow

To work on the blog locally, run Hugo's built-in live reload server:

```bash
cd blog
hugo server
```
The site will be available at `http://localhost:1313/`.

To create a new post:
```bash
cd blog
hugo new posts/your-post-slug.md
```
This generates a new markdown file with default metadata structure under `blog/content/posts/your-post-slug.md`.

---

## 5. Prompt for Integrating a New Blog Post

Copy and use this prompt whenever you want to add a new article to the blog.

***

### copy-paste prompt:

> **New Blog Post Integration:**
>
> I have written a new blog post and saved the files here:
> - **Content Text File:** `@[/Users/raghavgarg/NotOnCloud/Blog 2/Blog2.txt]` 
> - **Banner Image:** `@[/Users/raghavgarg/NotOnCloud/Blog 2/Image2.png]`
>
> **Instructions:**
> 1. **Asset Management:**
>    - Copy the high-res banner image (e.g. PNG, JPEG) directly to `blog/assets/images/` (create the `images` folder inside `assets` if it doesn't exist).
>    - Name it cleanly (e.g. `sif-market-trends.png`).
> 2. **Create Post File:**
>    - Create a new Markdown file: `blog/content/posts/sif-market-trends.md`.
>    - Add the YAML front matter block (point to the image under `images/` folder inside `blog/assets/`):
>      ```yaml
>      ---
>      title: "Your Post Title Here"
>      description: "Compelling summary of the post (max 160 characters)"
>      date: YYYY-MM-DD
>      image: "images/sif-market-trends.png"
>      tags: ["SIF", "Economy"]
>      ---
>      ```
>    - Copy the text content into the body of the Markdown file.
> 3. **Verify Locally:**
>    - Run `hugo` inside the `blog` directory. Hugo's layout templates will automatically process, resize, and convert the image into a lightweight `.webp` format on the fly!

