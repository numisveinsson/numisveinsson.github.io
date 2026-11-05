---
layout: page
permalink: /research/
title: Research
description: Computational modeling, artificial intelligence and medical imaging for cardiovascular and respiratory medicine.
nav: true
nav_order: 1
---

My research sits at the intersection of computational modeling, artificial intelligence and medical imaging. I develop automated methods that change how patient-specific models are built and simulated, with the goal of making high-fidelity cardiovascular simulation more accessible, scalable and clinically relevant.

## From images to anatomy

Building a simulation-ready model from a medical image has traditionally taken extensive manual work by trained experts. My Ph.D. with Prof. Shawn Shadden at UC Berkeley focused on removing that bottleneck.

<div class="research-row">
<figure class="plate">
<img src="{{ '/assets/img/home/theme-anatomy.jpg' | relative_url }}" alt="Aorta and iliac arteries traced automatically through an abdominal CT volume" loading="lazy">
</figure>
<div markdown="1">

**[SeqSeg](https://doi.org/10.1007/s10439-024-03611-z)** is a deep learning method that traces vessels step by step from a single seed point, processing small local segments at a time. Compared with global 2D and 3D nnU-Net models, it builds more complete vascular models and generalizes to vessels that were not annotated in its training data, on both CT and MR images.

</div>
</div>

<div class="research-row">
<figure class="plate">
<img src="{{ '/assets/img/home/work-meshgrow.jpg' | relative_url }}" alt="MeshGrow model of the heart chambers joined to the aorta and its branches" loading="lazy">
</figure>
<div markdown="1">

**[MeshGrow](https://doi.org/10.1177/20480040261455944)** connects the vasculature to the rest of the cardiovascular system, in this case the cardiac chambers, to create one complete anatomical model. Existing methods handle either the heart or the vessels. MeshGrow combines template deformation for the cardiac chambers with step-wise growth for the vasculature, and produces a single simulation-ready mesh with a defined aortic valve surface.

</div>
</div>

## Simulation in minutes

<div class="research-row">
<figure class="plate">
<img src="{{ '/assets/img/home/theme-simulation.jpg' | relative_url }}" alt="A vascular model simplified step by step into a reduced-order network of vessels and junctions" loading="lazy">
</figure>
<div markdown="1">

**[MIROS](https://github.com/BryannGan/MIROS)** (Medical Image to Reduced Order Simulation) is an automated pipeline that integrates SeqSeg-based geometry generation with reduced-order modeling of blood flow. It produces hemodynamic simulations within minutes, reducing the manual and computational burden and making large-scale studies practical.

</div>
</div>

## Digital twins of the heart and lungs

<div class="research-row">
<figure class="plate">
<img src="{{ '/assets/img/home/theme-twins.jpg' | relative_url }}" alt="Simulated blood flow streamlines through a patient-specific heart and aorta" loading="lazy">
</figure>
<div markdown="1">

As a Postdoctoral Fellow in the Center for Computational Medicine at UT Austin, working with Prof. Charley Taylor, I am extending this work to clinically driven applications of AI and simulation. The cardiovascular and respiratory systems are physiologically coupled, so my current work integrates the two, combining simulation with AI-based segmentation to develop digital twin frameworks.

This work is carried out in collaboration with the Cardiovascular Biomechanics Computation Lab at Stanford University and the Shadden Lab at UC Berkeley.

</div>
</div>

## Open science

Research tools only help if others can use them. I release my methods as [open-source software]({{ '/software/' | relative_url }}), contribute to the [SimVascular](https://simvascular.github.io) platform, and have co-organized SimVascular tutorials at CMBBE 2025 and ASME SB3C 2025. I also contribute to the [Vascular Model Repository](https://www.vascularmodel.com), a public resource for sharing high-quality vascular data and models.

## Where this is going

Three directions connect my past work to the questions I want to pursue next:

- **AI-enhanced multi-scale modeling:** methods that bridge spatial and temporal scales, with uncertainty quantified through the modeling pipeline.
- **Real-time clinical decision support:** fast simulation and automated workflows that fit into routine clinical imaging and treatment planning.
- **Data-driven discovery:** analyzing large cohorts of patient-specific models to reveal patterns in cardiovascular disease and treatment response.

If you work on any of these, I'd be glad to [hear from you]({{ '/contact/' | relative_url }}).
