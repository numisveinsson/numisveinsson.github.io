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
  - name: Why This Is Hard
  - name: The Manual Workflow
  - name: Looking Locally Instead
  - name: What Actually Worked
  - name: What's Still Rough
  - name: Try It Yourself
---

## Why This Is Hard

If you want to simulate blood flow in a _specific_ patient's arteries—to plan a treatment, test a device, or see how a disease is progressing—you need a 3D model of that person's vessels first. The simulation itself is hard enough. Getting a usable geometry out of a CT or MR scan is often worse.

That middle step, image to model, is still mostly done by hand. It's slow, expensive, and it doesn't scale.

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/ct_2_model_post/p-specific computational modeling-geometry_input.png" title="From medical image to patient-specific simulation" alt="Patient-specific modeling pipeline: a medical image scan is converted into a 3D geometric model and then a blood flow simulation" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    The patient-specific modeling pipeline for a coronary artery model: scan → 3D geometry → blood-flow simulation. SeqSeg is aimed at that middle step.
</div>

## The Manual Workflow

For more than 20 years, the usual path from a CT or MR scan to a simulation-ready vascular model has looked like this:

1. **Trace centerlines** through every vessel you care about—usually by hand.
2. **Segment the lumen** (the open channel blood flows through) at many cross-sections along those centerlines.
3. **Loft and join** the cross-sections and branches into one connected 3D model.

Each of those steps means a trained person clicking through slices. For a big study, or anything clinical where you need answers soon, that is the bottleneck.

During my PhD at UC Berkeley with Prof. Shawn Shadden, I set out to automate as much of this as I could. The method we ended up with is called **SeqSeg** (Sequential Segmentation).

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/ct_2_model_post/manual_vs_DL_modeling_compare.png" title="Manual SimVascular workflow versus automated SeqSeg" alt="Comparison of the manual SimVascular modeling workflow (top) against the automated SeqSeg workflow (bottom)" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Same model, two workflows. <strong>Top:</strong> the usual SimVascular path—path points, lumen segments, lofting—where each step costs expert time. <strong>Bottom:</strong> SeqSeg, which walks through local subvolumes from a single seed. Because the manual route takes so long, people often stop at the major vessels; automation makes it practical to keep going into smaller branches.
</div>

## Looking Locally Instead

A lot of ML approaches try to segment the whole scan in one shot. That is a tough problem: vessels are a tiny fraction of the voxels, their shape varies a lot between patients, and you still need a connected tree at the end—not a pile of disconnected blobs.

SeqSeg does something simpler. It only looks at a small neighborhood at a time and walks along the vessel, roughly the way you'd follow a road without needing the whole map in your head.

In practice:

- Start from a seed point inside a vessel, plus a rough guess of its size and direction.
- Crop a small box around that point and run a 3D U-Net on just that subvolume.
- From the local segmentation, pull a short centerline and estimate where the vessel is headed next.
- Step forward and repeat.
- If the vessel forks, put the branch on a queue and come back to it later—usually finishing the larger vessels first.

That is the whole loop. From one click, SeqSeg grows a connected vascular tree. You don't have to draw centerlines up front; it builds them as it goes, which is often the part that ate the most time in the old workflow.

<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/publication_preview/mr_model_tracing_fast_shorter.gif" title="SeqSeg automatic tracing" alt="Animation of SeqSeg sequentially tracing and segmenting a vascular tree from a single seed point" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    SeqSeg tracing from a single seed: local segments, one after another, assembled into a full tree.
</div>

## What Actually Worked

We tested SeqSeg on CT and MR images of aortic and aortofemoral anatomy and compared it to strong baselines (2D and 3D nnU-Net). A few things stuck with me:

- **It generalizes better than I expected.** Up close, a vessel looks like a vessel—coronary, aorta, cerebral. Because SeqSeg only ever sees those local neighborhoods, it could segment anatomies it never saw in training. On an independent hospital dataset it hadn't been trained on, it even picked up branches that were missing from the "ground truth."

- **It stays connected.** Pixel-wise methods often leave gaps, and a broken lumen is useless for simulation. Building the model step by step keeps the tree together, and the branch history is handy when you need to place inlets and outlets.

- **It's faster, and it reaches farther.** On the same hardware we saw roughly 20–80 minutes depending on how many branches it chased, versus about 2–3 hours for the benchmark—and SeqSeg usually kept more of the smaller distal branches.

## What's Still Rough

I'm not trying to put experts out of a job. I want them to spend less time clicking and more time on the parts that actually need judgment—and I want patient-specific simulation to be something you can do for more than a handful of cases.

SeqSeg still has sharp edges. If a bifurcation root is hidden by artifacts, a branch can get dropped. The voxel segmentation can leave staircase noise on the surface. And calling a network at every step gets expensive when the vascular tree is huge. Those are the problems I've kept working on since.

## Try It Yourself

SeqSeg is open access in _Annals of Biomedical Engineering_:

- **Paper:** [SeqSeg: Learning Local Segments for Automatic Vascular Model Construction](https://link.springer.com/article/10.1007/s10439-024-03611-z)
- **Code:** [github.com/numisveinsson/SeqSeg](https://github.com/numisveinsson/SeqSeg)
- **Data:** training and test models from the open [Vascular Model Repository](https://vascularmodel.com)

If you want a walkthrough of setup, training, and inference, there's a [companion tutorial](/blog/2025/seqseg_setup/) on this blog.

Questions or stuck somewhere in the pipeline? Leave a comment below.
