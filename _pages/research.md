---
layout: page
permalink: /research/
title: research
description: Research statement outlining past contributions, current work, and future directions in computational medicine, cardiovascular modeling, and AI-driven healthcare solutions.
nav: false
nav_order: 2
toc:
  sidebar: left
---

## Overview

My research program sits at the intersection of **computational modeling**, **artificial intelligence**, and **medical imaging** to advance cardiovascular and respiratory medicine. I develop automated, data-driven methods that transform how we construct patient-specific models, perform simulations, and translate computational tools into clinical practice. My work bridges fundamental engineering principles with real-world medical challenges, with the ultimate goal of making high-fidelity cardiovascular simulations more accessible, scalable, and clinically relevant.

<!-- 
TODO: Add research overview/conceptual diagram here showing the intersection of:
- Computational Modeling
- Artificial Intelligence  
- Medical Imaging
- Clinical Translation (outer layer)

Example figure code:
<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.html path="assets/img/research_overview.png" title="Research Overview" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    My research program integrates computational modeling, artificial intelligence, and medical imaging to advance cardiovascular medicine and enable clinical translation.
</div>
-->

---

## Past Research Contributions

### Automated Vascular Model Construction

During my Ph.D. at UC Berkeley with Prof. Shawn Shadden, I developed **SeqSeg** (Sequential Segmentation), a novel deep learning framework for automatically constructing patient-specific vascular models from medical imaging data. Traditional workflows for generating simulation-ready geometric models are time-consuming, requiring extensive manual intervention from trained experts. SeqSeg addresses this bottleneck by:

- **Local, sequential processing**: Using a U-Net-based architecture to iteratively track and segment vascular structures, processing only small segments at a time
- **Generalization to unannotated anatomy**: Demonstrating superior performance compared to global 2D/3D models (e.g., nnU-Net) in segmenting complete vasculature and handling structures not present in training data
- **Multi-modal compatibility**: Successfully applied to both computed tomography (CT) and magnetic resonance (MR) imaging data

<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/publication_preview/mr_model_tracing_fast_shorter.gif" title="SeqSeg Automatic Tracing" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    SeqSeg automatically traces and segments vascular structures from medical images, starting from a single seed point. The method processes local segments sequentially, enabling complete vascular tree reconstruction.
</div>

This work resulted in a first-author publication in *Annals of Biomedical Engineering* (2025) and established the foundation for my subsequent research directions.

### Integrated Cardiovascular Modeling

Building on SeqSeg, I developed **MeshGrow**, an integrated framework that automatically reconstructs both cardiac chambers and vascular structures to generate unified, simulation-ready cardiovascular meshes. This work addressed a critical limitation: existing methods typically handle either cardiac or vascular modeling separately, but not both together. MeshGrow:

- **Combines template deformation** for cardiac structures with **step-wise growth** for vascular regions
- **Automatically generates valve boundaries** connecting cardiac and vascular domains
- **Produces simulation-ready meshes** with minimal human intervention

<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.html path="assets/img/publication_preview/fimh_2025_cropped.png" title="MeshGrow Results" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    MeshGrow generates unified cardiac and vascular meshes from medical images, automatically connecting cardiac chambers with vascular structures through valve boundaries.
</div>

This research was presented at FIMH 2025 and published in the conference proceedings, demonstrating state-of-the-art performance on test datasets.

### Reduced-Order Simulation Pipeline

I also contributed to **MIROS** (Medical Image to Reduced Order Simulation), a fully automated pipeline that integrates SeqSeg-based geometry generation with reduced-order modeling of blood flow. This work significantly reduces the computational and manual burden traditionally required for patient-specific hemodynamic analyses, enabling rapid simulations within minutes rather than hours or days.

### Open-Source Contributions

Throughout my Ph.D., I actively contributed to the **SimVascular** open-source platform, a widely-used tool for patient-specific cardiovascular modeling. My contributions included software development, documentation, and user support, and I co-organized SimVascular tutorials at major conferences (CMBBE 2025, ASME SB3C 2025). I also contributed to the **Vascular Model Repository**, a public resource for sharing high-quality vascular data and models with standardized metadata and quality control.

---

## Current Research

As a Postdoctoral Fellow at the Center for Computational Medicine at UT Austin, working with Prof. Charley Taylor, I am expanding my research to explore **clinically driven applications of AI and simulation** with the goal of developing digital tools that bridge computational models and patient care.

### Cardiovascular-Respiratory Integration

My current work focuses on integrating cardiovascular and respiratory modeling, recognizing that these systems are physiologically coupled. I am developing methods to:

- **Model cardiopulmonary interactions** using computational fluid dynamics and finite element methods
- **Leverage AI for multi-organ segmentation** from medical images
- **Develop digital twin frameworks** that can predict patient-specific responses to interventions

This work is conducted in collaboration with the Cardiovascular Biomechanics Computation Lab at Stanford University and the Shadden Lab at UC Berkeley, building on my existing network while expanding into new research directions.

### Clinical Translation

A key focus of my postdoctoral work is ensuring that computational tools are designed with clinical workflows in mind. I am working to:

- **Validate methods on diverse patient populations** to ensure generalizability
- **Develop user-friendly interfaces** that integrate with existing clinical software
- **Establish partnerships with clinicians** to understand real-world needs and constraints

---

## Future Research Directions

My future research program will build on these foundations while addressing critical challenges in computational medicine. I envision three interconnected research themes:

<!-- 
TODO: Add three research themes diagram here showing:
- Theme 1: AI-Enhanced Multi-Scale Modeling
- Theme 2: Real-Time Clinical Decision Support  
- Theme 3: Data-Driven Discovery
With connections/overlaps between them

Example figure code:
<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/research_themes.png" title="Research Themes" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Three interconnected research themes that build on my past work and address critical challenges in computational medicine.
</div>
-->

### Theme 1: AI-Enhanced Multi-Scale Modeling

**Goal**: Develop AI-driven methods that seamlessly integrate across spatial and temporal scales—from cellular-level processes to organ-level function—to enable comprehensive patient-specific modeling.

**Specific Projects**:
1. **Multi-scale vascular modeling**: Develop deep learning methods that can predict microvascular behavior from macrovascular geometry and flow patterns, enabling more complete cardiovascular models without requiring high-resolution imaging of all vessels.

<!-- 
TODO: Add multi-scale modeling schematic showing:
- Cellular level → Tissue level → Organ level → System level
- How AI bridges across scales

Example figure code:
<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.html path="assets/img/multiscale_modeling.png" title="Multi-Scale Modeling" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    AI-enhanced methods integrate across spatial scales from cellular processes to organ-level function, enabling comprehensive patient-specific models.
</div>
-->

2. **Temporal modeling and prediction**: Create AI frameworks that can predict long-term cardiovascular outcomes (e.g., disease progression, response to treatment) by learning from longitudinal patient data and integrating with physics-based simulations.

3. **Uncertainty quantification**: Develop methods to quantify and propagate uncertainty through AI-enhanced modeling pipelines, critical for clinical decision-making.

**Expected Impact**: These methods will enable more comprehensive patient-specific models while reducing computational costs and imaging requirements.

### Theme 2: Real-Time Clinical Decision Support

**Goal**: Transform cardiovascular simulations from research tools into real-time clinical decision support systems that can guide diagnosis and treatment planning.

**Specific Projects**:
1. **Rapid simulation frameworks**: Develop ultra-fast simulation methods (combining reduced-order modeling, machine learning surrogates, and GPU acceleration) that can provide results within minutes for clinical workflows.

2. **Automated treatment planning**: Create AI systems that can automatically suggest optimal treatment strategies (e.g., stent placement, surgical planning) based on patient-specific simulations and clinical guidelines.

3. **Integration with clinical imaging**: Develop seamless workflows that automatically extract models from routine clinical imaging (CT, MRI) and provide actionable insights to clinicians.

<!-- 
TODO: Add clinical translation pipeline diagram showing:
Medical Imaging → Automated Modeling → Simulation → Clinical Decision Support → Patient Care

Example figure code:
<div class="row justify-content-sm-center">
    <div class="col-sm-10 mt-3 mt-md-0">
        {% include figure.html path="assets/img/clinical_pipeline.png" title="Clinical Translation Pipeline" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Automated pipeline from medical imaging to clinical decision support, enabling real-time patient-specific modeling in clinical workflows.
</div>
-->

**Expected Impact**: Make patient-specific modeling a routine part of clinical care, improving outcomes while reducing costs.

### Theme 3: Data-Driven Discovery in Cardiovascular Medicine

**Goal**: Leverage large-scale patient data and AI to discover new insights into cardiovascular disease mechanisms, risk factors, and treatment responses.

**Specific Projects**:
1. **Population-level modeling**: Develop methods to analyze large cohorts of patient-specific models to identify patterns, risk factors, and optimal treatment strategies.

2. **Biomarker discovery**: Use AI to identify new imaging-based biomarkers that predict cardiovascular outcomes, potentially enabling earlier intervention.

3. **Personalized treatment optimization**: Create frameworks that learn from patient outcomes to continuously improve treatment recommendations.

**Expected Impact**: Advance our fundamental understanding of cardiovascular disease while enabling more personalized medicine.

---

## Integration with Teaching and Service

### Teaching Integration

My research naturally integrates with teaching at both undergraduate and graduate levels:

- **Undergraduate courses**: I plan to develop courses on "Computational Methods in Biomedical Engineering" and "Medical Image Analysis," where students will learn both theoretical foundations and practical applications, using tools like SimVascular and methods I've developed.

- **Graduate courses**: I will teach advanced courses on "AI in Computational Medicine" and "Patient-Specific Modeling," where students will engage with cutting-edge research while developing their own projects.

- **Hands-on learning**: My emphasis on open-source tools and reproducible research will provide students with practical skills and real-world experience.

### Service Integration

My research program supports service to the field:

- **Open-source software**: I will continue developing and maintaining open-source tools (SeqSeg, MeshGrow, and future projects), making research accessible to the broader community.

- **Data sharing**: Through the Vascular Model Repository and similar initiatives, I will promote data sharing and reproducibility in computational medicine.

- **Standards development**: I will contribute to developing standards and best practices for patient-specific modeling, working with professional societies and standards organizations.

---

## Funding Strategy

My research program is designed to be fundable through multiple agencies and mechanisms:

### National Institutes of Health (NIH)
- **R01 grants**: For fundamental research on AI-enhanced modeling and clinical translation
- **R21/R33 grants**: For high-risk, high-reward projects on real-time clinical decision support
- **SBIR/STTR grants**: For translational projects with industry partners
- **Training grants**: To support graduate students and postdocs

### National Science Foundation (NSF)
- **CAREER Award**: For early-career faculty development and integration of research and education
- **CBET (Chemical, Bioengineering, Environmental and Transport Systems)**: For fundamental engineering research
- **CISE (Computer and Information Science and Engineering)**: For AI and computational methods

### American Heart Association (AHA)
- **Career Development Awards**: For cardiovascular-focused research
- **Transformational Project Awards**: For high-impact translational projects

### Industry Partnerships
- **Medical device companies**: For developing simulation tools for device design and testing
- **Pharmaceutical companies**: For drug delivery modeling and optimization
- **Healthcare systems**: For clinical validation and implementation studies

### Foundation Support
- **Whitaker Foundation** (if still active) or similar: For biomedical engineering research
- **Private foundations**: Focused on cardiovascular health and computational medicine

---

## Research Environment and Resources

To support this research program, I will need:

### Computational Resources
- **High-performance computing**: Access to HPC clusters for large-scale simulations
- **GPU clusters**: For training deep learning models and running GPU-accelerated simulations
- **Cloud computing**: For scalable, on-demand computational resources

### Data Resources
- **Clinical imaging data**: Partnerships with hospitals and medical centers for access to de-identified patient data
- **Public datasets**: Leveraging existing repositories (e.g., Vascular Model Repository, public imaging datasets)
- **Synthetic data generation**: Developing methods to generate synthetic training data when real data is limited

### Collaborations
- **Clinical partners**: Cardiologists, radiologists, and surgeons for clinical validation and translation
- **Engineering collaborators**: Experts in AI, computational mechanics, and medical imaging
- **Industry partners**: For translational research and technology transfer

### Laboratory Infrastructure
- **Software development**: Version control, continuous integration, and software distribution infrastructure
- **Data management**: Secure storage and management systems for sensitive medical data
- **Visualization tools**: For analyzing and presenting complex simulation results

---

## Expected Impact

My research program will advance computational medicine through:

1. **Scientific Impact**: 
   - Novel AI methods for medical image analysis and patient-specific modeling
   - Improved understanding of cardiovascular and respiratory physiology
   - New computational frameworks that integrate across scales and modalities

2. **Clinical Impact**:
   - Tools that improve diagnosis and treatment planning
   - Reduced time and cost for patient-specific modeling
   - Better patient outcomes through personalized medicine

3. **Educational Impact**:
   - Training next generation of computational medicine researchers
   - Open-source tools that enable broader research community
   - Integration of cutting-edge research into curriculum

4. **Societal Impact**:
   - More accessible and affordable healthcare through computational tools
   - Reduced healthcare costs through better treatment planning
   - Improved quality of life for patients with cardiovascular disease

---

## Conclusion

My research program builds on a strong foundation in computational modeling, AI, and medical imaging to address critical challenges in cardiovascular and respiratory medicine. By developing automated, data-driven methods and translating them into clinical practice, I aim to make patient-specific modeling more accessible and impactful. Through integration with teaching and service, I will train the next generation of researchers while contributing to the broader scientific community.

The interdisciplinary nature of this work—spanning engineering, computer science, and medicine—positions it at the forefront of computational medicine, with significant potential for scientific discovery, clinical translation, and societal impact.

---

*This research statement is a living document that evolves with my research program. For the most current information about my research activities, please see my [publications](/publications/) and [projects](/projects/) pages.*
