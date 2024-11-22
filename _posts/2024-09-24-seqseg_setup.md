---
layout: distill
title: SeqSeg Setup
description: A tutorial on setting up SeqSeg for medical image segmentation
categories: data-science
giscus_comments: false
date: 2024-09-24
featured: false
related_posts: true

authors:
  - name: Numi Sveinsson Cepero
    url: numisveinsson.com
    affiliations:
      name: UC Berkeley

# Optionally, you can add a table of contents to your post.
# NOTES:
#   - make sure that TOC names match the actual section names
#     for hyperlinks within the post to work correctly.
#   - we may want to automate TOC generation in the future using
#     jekyll-toc plugin (https://github.com/toshimaru/jekyll-toc).
toc:
  - name: Clone the Repository
  - name: Install Dependencies
  - name: Locate Data and Model Weights
  - name: Run Test Script
  - name: Use Correct Arguments

---

### Clone the Repository

To get started with SeqSeg, you'll need to clone the repository from GitHub. Open a terminal window and run the following command:

```bash
git clone https://github.com/numisveinsson/SeqSeg.git
```

This will create a local copy of the SeqSeg repository on your machine.

### Install Dependencies

SeqSeg has several dependencies that need to be installed before you can run the code. To install the required packages, navigate to the SeqSeg directory and run the following command:

```bash
pip install -r requirements.txt
```

This will install all the necessary Python packages for SeqSeg to run successfully.

### Locate Data and Model Weights