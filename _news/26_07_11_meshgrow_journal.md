---
layout: post
title: "New Paper Published: MeshGrow in JRSM Cardiovascular Disease"
date: 2026-07-11 09:00:00-0500
inline: false
related_posts: false
---

:tada: **Big news!** Our paper, **_MeshGrow: Integrated framework for simulation-ready cardiac and vascular mesh construction from medical imaging_**, is now out — **open access** — in _JRSM Cardiovascular Disease_! :star: :heart:

<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/cardiac_combo.png" title="A combined cardiac and vascular model built by MeshGrow" alt="Left: a labeled model with colored cardiac chambers and the aorta and its branches. Right: the same anatomy as a single unified mesh." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    MeshGrow builds a single, simulation-ready model of both the heart chambers and the aorta directly from a medical image.
</div>

MeshGrow is an integrated framework for building simulation-ready cardiac _and_ vascular models directly from medical images. It combines two machine learning based techniques in a two-stage approach: first meshing the cardiac chambers, then **growing** the aorta and its main sub-branches out from the heart, and returns a single simulation-suitable mesh with a defined aortic valve surface and the boundary surfaces needed to run patient-specific hemodynamics simulations.

We evaluated MeshGrow on five CT datasets—outperforming state-of-the-art benchmark methods—and ran full three-dimensional computational fluid dynamics simulations on two of the cases to confirm the models are truly simulation-ready.

<div class="row justify-content-sm-center">
    <div class="col-sm-11 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig5_MeshGrow_sims.png" title="CFD simulations on two MeshGrow models" alt="Computational fluid dynamics results for two cases: boundary-condition setup, velocity-magnitude streamlines, and wall shear stress magnitude." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Blood-flow simulations run directly on MeshGrow models: boundary-condition setup (left), velocity streamlines (middle), and wall shear stress (right).
</div>

This journal article extends our earlier [FIMH 2025 conference paper](https://link.springer.com/chapter/10.1007/978-3-031-94562-5_10) with additional test cases and full three-dimensional CFD simulations. Work with Arjun Narayanan, Fanwei Kong, and my PhD advisor Prof. Shawn Shadden.

**:point_right: Read the paper:** [MeshGrow: Integrated framework for simulation-ready cardiac and vascular mesh construction from medical imaging](https://journals.sagepub.com/doi/10.1177/20480040261455944)

For a plain-language walkthrough, see the blog post: [One Model, Heart and Vessels: How MeshGrow Builds Simulation-Ready Cardiovascular Anatomy](/blog/2026/meshgrow-heart-and-vessels-one-model/).
