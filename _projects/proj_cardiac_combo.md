---
layout: distill
title: MeshGrow - Combining Vascular and Cardiac Models into One
description: combining the models of the heart and the blood vessels into a single simulation-ready model for patient-specific simulations
img: assets/img/cardiac_combo.png
importance: 5
category: solo
related_publications:

toc:
  - name: Motivation
  - name: Background
  - name: Methods
  - name: Results
  - name: Publication
---

<img src="../../assets/img/cardiac_combo.png" alt="Combined patient-specific cardiac and vascular model" width="600"/>

## Motivation

The goal of this research project is to develop an automatic pipeline that constructs simulation-ready meshes encompassing both the cardiac structures (heart chambers) and the associated vasculature (including the aorta and pulmonary arteries). By merging cardiac and vascular geometric modeling into a single workflow, the objective is to make the setup of complex simulations faster, more efficient, and more accessible. This integration aims to facilitate advanced medical research and clinical applications by providing comprehensive patient-specific cardiovascular simulations.

## Background

Patient-specific cardiac and vascular simulations are crucial for understanding cardiovascular diseases, treatment planning, and medical education. However, creating accurate geometric models of both cardiac and vascular structures from medical imaging data remains challenging and time-consuming. Traditionally, these structures are modeled separately, requiring manual intervention and expertise in image segmentation and modeling techniques. By merging cardiac and vascular geometric modeling into a unified pipeline, this research seeks to overcome these challenges and provide a more holistic approach to cardiovascular simulation. The integration of deep learning techniques, such as segmentation and deformation algorithms, offers promising avenues for automating and optimizing the modeling process, thereby enabling more efficient and accurate simulations.

## Methods

1. **Heart Localization**: The heart is localized within a 3D medical image volume of the abdomen or torso using a deep learning segmentation technique. This process involves accurately identifying and segmenting the cardiac structures from surrounding anatomical features.

2. **Heart Modeling**: The heart chambers are modeled using a deep learning-based deformation technique known as LinFlowNet. This approach allows for the deformation of a heart template to fit the specific medical image data, resulting in a patient-specific representation of the cardiac anatomy.

3. **Vascular Modeling**: The vasculature is modeled using an automatic tracing and segmentation algorithm called SeqSeg. Unlike template-based approaches, SeqSeg assembles the vasculature geometry piece by piece, leveraging seed points for initialization.

4. **Initializing Vascular Tracing**: To initialize the tracing process for the vasculature, the cardiac model predicted by LinFlowNet is post-processed. Specifically, the aortic valve region is located on the model to produce a seed point, vessel size estimate, and direction for tracing.

5. **Combining Resulting Models**: Finally, the resulting cardiac and vascular models are combined into a single cohesive representation. This integration allows for the seamless interaction between cardiac and vascular structures, enabling comprehensive cardiovascular simulations.

By implementing these methods, the research aims to establish an automatic pipeline for merging cardiac and vascular geometric modeling, ultimately facilitating faster and more accurate patient-specific cardiovascular simulations.

<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig1_MeshGrow_workflow.png" title="The MeshGrow workflow" alt="MeshGrow workflow diagram: a CT scan feeds cardiac modeling (3D U-Net and LinFlo-Net template deformation) and vascular modeling (SeqSeg with valve processing), which are combined in an assembly stage using marching cubes and post-processing to produce a single cardiovascular mesh with defined boundaries." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    The MeshGrow workflow. From a single CT scan, the cardiac chambers are modeled with a 3D U-Net and LinFlo-Net template deformation, while the vasculature is traced with SeqSeg (initialized from a seed point at the aortic valve). The assembly stage merges the two via marching cubes and post-processing, yielding a single cardiovascular mesh with defined boundary surfaces.
</div>

## Results

We evaluated MeshGrow on five CT datasets, comparing its cardiac and vascular predictions against ground-truth models built by hand and against state-of-the-art benchmark methods. MeshGrow achieved higher metric scores than the benchmarks.

<div class="row justify-content-sm-center">
    <div class="col-sm-11 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig4_MeshGrow_results.png" title="Qualitative MeshGrow results across five CT cases" alt="Grid comparing, for five CT cases, the cardiac ground truth, cardiac prediction from LinFloNet, aorta ground truth, aorta prediction from SeqSeg, and the final combined model." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Qualitative results on the five CT test cases. From left to right: the cardiac ground truth, the cardiac chamber prediction (LinFlo-Net), the aortic ground truth, the aortic prediction (SeqSeg), and the final combined model that fuses the two.
</div>

To confirm the output is truly simulation-ready, we ran full three-dimensional computational fluid dynamics simulations on two of the test cases, using the mesh's defined valve, inlet, and outlet surfaces to prescribe boundary conditions.

<div class="row justify-content-sm-center">
    <div class="col-sm-11 mt-3 mt-md-0">
        {% include figure.html path="assets/img/meshgrow/fig5_MeshGrow_sims.png" title="CFD simulations on two MeshGrow models" alt="Computational fluid dynamics results for cases 4 and 5: the boundary-condition setup with prescribed pressure, open valve, and prescribed deformation; velocity-magnitude streamlines; and wall shear stress magnitude." class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Three-dimensional CFD simulations run directly on two MeshGrow models (cases 4 and 5). <strong>Left:</strong> the boundary-condition setup—prescribed inlet pressures, an open aortic valve, and prescribed wall deformation. <strong>Middle:</strong> velocity-magnitude streamlines. <strong>Right:</strong> wall shear stress magnitude on the vessel walls.
</div>

## Publication

This work, named **MeshGrow**, has been published, open access, in _JRSM Cardiovascular Disease_. We evaluated the framework on five CT test datasets—achieving higher metric scores than state-of-the-art benchmark methods—and demonstrated its applicability by running three-dimensional computational fluid dynamics simulations on two of the test cases.

- **Journal paper:** [MeshGrow: Integrated framework for simulation-ready cardiac and vascular mesh construction from medical imaging](https://journals.sagepub.com/doi/10.1177/20480040261455944) (_JRSM Cardiovascular Disease_, 2026)
- **Conference paper:** [Integrated Framework for Unified Cardiac and Vascular Mesh Construction from Medical Images](https://link.springer.com/chapter/10.1007/978-3-031-94562-5_10) (FIMH 2025)
- **Plain-language explainer:** [One Model, Heart and Vessels: How MeshGrow Builds Simulation-Ready Cardiovascular Anatomy](/blog/2026/meshgrow-heart-and-vessels-one-model/)
