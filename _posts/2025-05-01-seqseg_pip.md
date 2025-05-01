---
layout: distill
title: SeqSeg, Now a Pip Installable Package
description: A tutorial on setting up SeqSeg for medical image segmentation
categories: data-science
giscus_comments: false
date: 2025-05-01
featured: true
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
  - name: Pip Installation
  - name: Tutorial

---

## 1. Pip Installation
[SeqSeg](https://pypi.org/project/seqseg/) is now available as a pip installable package! This makes it easier to install and use in your projects. To install SeqSeg, simply run the following command in your terminal:

```bash
pip install seqseg
```

This will install the latest version of SeqSeg along with all its dependencies.

## 2. Tutorial
To get started with SeqSeg, you can follow the tutorial provided in the [SeqSeg GitHub repository](https://github.com/numisveinsson/SeqSeg/blob/main/seqseg/tutorial/tutorial.md). The tutorial has data and code examples to help you understand how to use SeqSeg for medical image segmentation tasks. The data is the same as [SimVascular](https://simvascular.github.io/). Main steps in the tutorial include:
1. **Seed Point Definition**: Define seed points in the images where you want to start the segmentation.
2. **Weight Downloading**: Download the pre-trained weights for the model.
3. **Segmentation**: Run the segmentation algorithm on your images using the defined seed points and downloaded weights.
4. Visualization: Visualize the segmentation results to assess the performance of the model.