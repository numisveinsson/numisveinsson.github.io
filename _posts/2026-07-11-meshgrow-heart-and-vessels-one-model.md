---
layout: distill
title: "One Model, Heart and Vessels: How MeshGrow Builds Simulation-Ready Cardiovascular Anatomy"
description: A plain-language explainer of MeshGrow, an automated framework for constructing combined cardiac and vascular models from medical images
categories: research
giscus_comments: true
date: 2026-07-11
featured: true
related_posts: true

authors:
  - name: Numi Sveinsson Cepero
    url: numisveinsson.com
    affiliations:
      name: Oden Institute, UT Austin

toc:
  - name: The Problem
  - name: Why the Heart and the Vessels Fight Back
  - name: "The Core Idea: Two Tools for Two Anatomies"
  - name: Stitching the Heart to the Vessels
  - name: What We Found
  - name: Why This Matters
  - name: Read the Paper
---

## The Problem

To simulate blood flow through a patient's cardiovascular system—to plan a procedure, test a device, or study how disease is progressing—you first need an accurate 3D model of that person's anatomy. And ideally, you want the _whole_ picture: the heart chambers pumping the blood and the arteries carrying it away.

The trouble is that building these models from a CT or MR scan is one of the slowest, most manual steps in the entire pipeline. Existing automated methods have mostly picked a side: some are good at reconstructing the **cardiac chambers**, others at tracing the **vasculature**. Very few produce a single, connected, simulation-ready model of both.

MeshGrow is our attempt to close that gap.

<div class="row justify-content-sm-center">
    <div class="col-sm-11 mt-3 mt-md-0">
        {% include figure.html path="assets/img/cardiac_combo.png" title="A combined cardiac and vascular model built by MeshGrow" alt="Left: a labeled model with colored cardiac chambers and the aorta and its branches. Right: the same anatomy as a single unified gray mesh." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    A combined cardiovascular model produced by MeshGrow. <strong>Left:</strong> the labeled anatomy—cardiac chambers plus the aorta and its main sub-branches. <strong>Right:</strong> the same structures merged into a single, watertight mesh that is ready for a blood-flow simulation.
</div>

## Why the Heart and the Vessels Fight Back

Cardiac chambers and blood vessels look nothing alike, and that is exactly the problem.

- **The heart chambers** are big, blob-like volumes. Their overall shape is fairly consistent from patient to patient, so a method that "knows" what a heart looks like can deform a template to fit a new scan.
- **The vessels** are thin, branching tubes that vary enormously between people and make up only a tiny fraction of the pixels in a scan. A rigid template can't anticipate where every branch goes; you have to follow them.

Trying to force one technique to handle both anatomies tends to do neither well. So instead of looking for a single hammer, MeshGrow uses the right tool for each job.

## The Core Idea: Two Tools for Two Anatomies

MeshGrow is a **two-stage** framework:

1. **Mesh the heart.** For the cardiac chambers, we use a template-based deep learning approach. The method starts from a mesh that already encodes what a healthy heart's chambers look like, and deforms it to match the patient in the scan. Because the template carries prior knowledge of cardiac anatomy, this stays robust even where image quality is poor.

2. **Grow the vessels out from it.** For the aorta and its main sub-branches, we use a step-wise, growth-based tracer (the same family of ideas behind [SeqSeg](/blog/2026/blurry-ct-to-simulation-ready-artery/)): starting near the heart, it follows each vessel locally, one small piece at a time, and assembles the branches into a connected tree.

The name says it all—we mesh the heart first, then _grow_ the vasculature outward from it.

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig1_MeshGrow_workflow.png" title="The MeshGrow workflow" alt="MeshGrow workflow diagram: a CT scan feeds cardiac modeling (3D U-Net and LinFlo-Net template deformation) and vascular modeling (SeqSeg with valve processing), which are combined in an assembly stage using marching cubes and post-processing to produce a single cardiovascular mesh with defined boundaries." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    The full MeshGrow pipeline. Starting from a single CT scan, the cardiac chambers are meshed by deforming a template (top), the vessels are traced piece by piece with SeqSeg starting from a seed point at the aortic valve (bottom left), and the two are fused in an assembly stage into one cardiovascular mesh with defined boundary surfaces (right).
</div>

## Stitching the Heart to the Vessels

Building two halves is only useful if they connect properly. The interesting engineering in MeshGrow is at the seam: the framework joins the cardiac mesh and the vascular mesh into a single watertight surface, and—critically—defines an **aortic valve surface** where the left ventricle meets the aorta.

That valve surface, along with the vessel inlets and outlets, is exactly what a solver needs to apply **boundary conditions**: where blood enters, where it leaves, and how the valve gates flow. Without them, you have a pretty picture; with them, you have a computational domain you can actually run physics on.

## What We Found

We tested MeshGrow on five CT datasets, comparing its output against state-of-the-art benchmark methods and against ground-truth models built by hand.

- **Higher accuracy.** MeshGrow achieved higher metric scores than the benchmark methods across the test data.
- **It actually simulates.** To prove the models are simulation-ready and not just visually plausible, we ran full three-dimensional computational fluid dynamics (CFD) simulations on two of the test cases—end to end, from image to hemodynamics.
- **One connected model.** By meshing the chambers and growing the vessels with anatomy-specific tools and then fusing them, MeshGrow returns a unified mesh with the valve and boundary surfaces already in place.

<div class="row justify-content-sm-center">
    <div class="col-sm-11 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig5_MeshGrow_sims.png" title="CFD simulations on two MeshGrow models" alt="Computational fluid dynamics results for two cases: the boundary-condition setup with prescribed pressure, open valve, and prescribed deformation; velocity-magnitude streamlines; and wall shear stress magnitude." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Blood-flow simulations run directly on two MeshGrow models. The unified mesh already carries what a solver needs—an open aortic valve, inlet/outlet surfaces, and prescribed wall motion (left)—so we can compute velocity streamlines (middle) and wall shear stress (right) without any extra hand-cleanup.
</div>

## Why This Matters

Most automated modeling tools force a choice between the heart and the vessels. MeshGrow shows that you don't have to choose: by matching the method to the anatomy—template deformation for the chambers, growth-based tracing for the vessels—you can automate the construction of a _combined_ cardiovascular model.

That is a step toward making patient-specific simulation practical at scale: large-cohort studies and, eventually, time-sensitive clinical settings where waiting hours to hand-build a model isn't an option.

## Read the Paper

MeshGrow is published, open access, in _JRSM Cardiovascular Disease_:

- **Paper:** [MeshGrow: Integrated framework for simulation-ready cardiac and vascular mesh construction from medical imaging](https://journals.sagepub.com/doi/10.1177/20480040261455944)
- **Earlier conference version:** [Integrated Framework for Unified Cardiac and Vascular Mesh Construction from Medical Images (FIMH 2025)](https://link.springer.com/chapter/10.1007/978-3-031-94562-5_10)
- **Related work:** the vessel-growing idea builds on [SeqSeg](/blog/2026/blurry-ct-to-simulation-ready-artery/)

_This work was done with Arjun Narayanan, Fanwei Kong, and Prof. Shawn Shadden. Curious about automated cardiovascular modeling, or have thoughts on where the remaining bottlenecks are? I'd love to hear from you—reach out or leave a comment below._
