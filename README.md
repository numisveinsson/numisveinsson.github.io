# numisveinsson.com

Source for the personal academic website of **Numi Sveinsson Cepero**, Postdoctoral Fellow at the Center for Computational Medicine, Oden Institute for Computational Engineering and Sciences, UT Austin.

Live site: **https://numisveinsson.com**

[![deploy](https://github.com/numisveinsson/numisveinsson.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/numisveinsson/numisveinsson.github.io/actions/workflows/deploy.yml)

## About

The site is built with [Jekyll](https://jekyllrb.com/) on the [al-folio](https://github.com/alshedivat/al-folio) academic theme and deployed to GitHub Pages. It hosts my publications, projects, talks, CV, news, and blog posts on computational medicine, cardiovascular and respiratory modeling, deep learning, and medical imaging.

## Repository structure

| Path                                | Purpose                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `_pages/`                           | Static pages (about, blog, CV, research, contact, etc.)   |
| `_posts/`                           | Blog posts                                                |
| `_projects/`                        | Projects collection                                       |
| `_news/`                            | News / announcements                                      |
| `_bibliography/papers.bib`          | Publications (BibTeX, rendered via jekyll-scholar)        |
| `_data/`                            | Site data (talks, socials, repositories)                  |
| `assets/`                           | Images, PDFs, CSS, JS, and `json/resume.json` (CV source) |
| `_layouts/`, `_includes/`, `_sass/` | Theme templates and styles                                |

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.

## Deployment

Pushing to `main`/`master` triggers `.github/workflows/deploy.yml`, which builds the site, runs PurgeCSS, and publishes `_site` to the `gh-pages` branch.

## Credits

Built on [al-folio](https://github.com/alshedivat/al-folio) by Maruan Alshedivat and contributors, licensed under the MIT License.
