---
layout: distill
title: "How Do You Turn a Blurry CT Scan into a Simulation-Ready Artery?"
description: A plain-language explainer of SeqSeg, an automated method for building patient-specific vascular models from medical images
categories: research
giscus_comments: true
date: 2026-06-19
featured: true
related_posts: true

authors:
  - name: Numi Sveinsson Cepero
    url: numisveinsson.com
    affiliations:
      name: Oden Institute, UT Austin

# Optionally, you can add a table of contents to your post.
# NOTES:
#   - make sure that TOC names match the actual section names
#     for hyperlinks within the post to work correctly.
#   - we may want to automate TOC generation in the future using
#     jekyll-toc plugin (https://github.com/toshimaru/jekyll-toc).
toc:
  - name: The Problem
  - name: The Bottleneck Nobody Talks About
  - name: "The Core Idea: Look Locally, Build Globally"
  - name: What Surprised Me
  - name: Why This Matters
  - name: Try It Yourself
---

## The Problem

Doctors and researchers increasingly want to simulate blood flow inside a _specific_ patient's arteries—to plan a treatment, test a medical device, or understand how a disease is progressing. These patient-specific simulations have become a critical part of diagnosing, treating, and understanding cardiovascular disease.

But before you can simulate anything, you need an accurate, three-dimensional model of that person's blood vessels. And building one turns out to be one of the slowest, most manual steps in the entire process.

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/ct_2_model_post/p-specific computational modeling-geometry_input.png" title="From medical image to patient-specific simulation" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    The patient-specific modeling pipeline for a coronary artery model: a medical image scan is converted into a 3D geometric model, which then becomes the computational domain for a patient-specific blood flow simulation. The middle step—turning the scan into geometry—is the manual bottleneck SeqSeg aims to automate.
</div>

## The Bottleneck Nobody Talks About

For more than 20 years, the workflow for turning a medical scan (a CT or MR image) into a simulation-ready vascular model has looked roughly like this:

1. **Trace centerlines** through every vessel of interest—usually by hand.
2. **Segment the vessel lumen** (the open channel blood flows through) at many cross-sections along those centerlines.
3. **Loft and join** all those cross-sections and branches into a single, connected 3D model.

Every one of these steps depends on a trained expert clicking through the image slice by slice. It is time-consuming, costly, and introduces user bias. For large studies—or any clinical application where results are needed quickly—this manual model-building has remained the primary bottleneck.

For my PhD at UC Berkeley, working with Prof. Shawn Shadden, I wanted to automate it. The result is a method we call **SeqSeg** (Sequential Segmentation).

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/ct_2_model_post/manual_vs_DL_modeling_compare.png" title="Manual SimVascular workflow versus automated SeqSeg" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Two ways to build the same vascular model. <strong>Top:</strong> the traditional manual workflow in SimVascular—placing path points, segmenting the lumen along each path, and lofting them into a model—where each step demands expert time. <strong>Bottom:</strong> SeqSeg, which steps through local subvolumes automatically from a single seed point. Because the manual approach is so time-consuming and costly, modelers often stop at the major vessels; SeqSeg's automation lets it capture many more of the smaller branches.
</div>

## The Core Idea: Look Locally, Build Globally

Most machine learning approaches try to understand an entire scan at once. That is hard: blood vessels make up only a tiny fraction of the pixels in a 3D scan, their geometry varies enormously between patients, and keeping a highly-branched structure connected is tricky.

SeqSeg takes a different approach. Instead of swallowing the whole image, it explores the vasculature **one small piece at a time**—a bit like following a road one block at a time rather than memorizing the entire map.

Here is the intuition, without the jargon:

- **Start from a single seed point** inside a vessel, with a rough estimate of its size and direction.
- **Look at just the small box around it**, and use a neural network (a 3D U-Net) to segment the vessel in that local subvolume.
- **Use that local shape** to extract a short centerline and figure out which way the vessel is heading.
- **Step forward** along that direction and repeat.
- **When the vessel forks**, store the branch in a queue and come back to it after finishing the current one—prioritizing the largest vessels first, much like a human would.

Piece by piece, SeqSeg traces and assembles the entire connected vascular tree from that one starting click. There is no need to draw centerlines in advance—it generates them automatically as it goes, which is often the most labor-intensive step of the traditional workflow.

<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/publication_preview/mr_model_tracing_fast_shorter.gif" title="SeqSeg automatic tracing" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    SeqSeg automatically traces and segments vascular structures from medical images, starting from a single seed point. It processes local segments sequentially, assembling them into a complete vascular tree.
</div>

## What Surprised Me

A few results stood out when we tested SeqSeg on CT and MR images of aortic and aortofemoral anatomy, comparing against state-of-the-art benchmark models (2D and 3D nnU-Net):

- **It generalizes.** Because SeqSeg only ever looks locally—and vessels look remarkably similar up close, whether it is a coronary artery, the aorta, or a cerebral artery—it could segment vessels it had never seen during training. It even performed strongly on a completely independent hospital dataset it was never trained on, capturing branches that were missing from the "ground truth."

- **It stays connected.** Most segmentation methods classify each pixel independently, which often leaves gaps and disconnected fragments that break a simulation. By building the model step-by-step and tracking how branches connect, SeqSeg keeps the anatomy unified—exactly what you need to actually run physics on it. It also remembers branch connectivity, which helps place the inlet and outlet conditions a simulation requires.

- **It is faster, and reaches farther.** On the same hardware, SeqSeg ran in roughly 20–80 minutes (depending on how many branches it traced) versus 2–3 hours for the benchmark—while consistently capturing more of the smaller, distal branches and producing more robust results.

## Why This Matters

The goal here is not to replace the expert. It is to give clinicians and researchers their time back, and to make patient-specific cardiovascular simulation accessible enough to use at scale—in large-cohort studies and, eventually, in time-sensitive clinical settings.

There is still plenty to improve. SeqSeg relies on accurately capturing the root of each bifurcation, so a branch can be missed if its junction is obscured by image artifacts. The voxel-based segmentation can leave small staircase artifacts on the final surface, and running a neural network at every step can scale poorly for very extensive vascular networks. These are the kinds of problems I have continued to work on since.

## Try It Yourself

SeqSeg is published, open access, in _Annals of Biomedical Engineering_:

- **Paper:** [SeqSeg: Learning Local Segments for Automatic Vascular Model Construction](https://link.springer.com/article/10.1007/s10439-024-03611-z)
- **Code:** [github.com/numisveinsson/SeqSeg](https://github.com/numisveinsson/SeqSeg)
- **Data:** the training and test models come from the open [Vascular Model Repository](https://vascularmodel.com)

If you want a hands-on walkthrough of setting up SeqSeg—from preparing a new dataset through training and inference—see my companion tutorial post on this blog.

---

_Working on automation in medical imaging or cardiovascular modeling? I would love to hear where you think the biggest remaining bottlenecks are—feel free to reach out or leave a comment below._
