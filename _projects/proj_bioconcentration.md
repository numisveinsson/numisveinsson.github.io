---
layout: distill
title: Bioprinting; Modeling Cell Survival
description: Modeling chemical concentration via diffusion equation to inform bioprinting template design
img: assets/img/bioprinting.jpg
importance: 3
category: collaboration
related_publications:

toc:
  - name: Big Picture
  - name: Methods
  - name: Time-Dependent Diffusion Equation
  - name: Finite Element Method and FEniCS
  - name: Geometric Construction
---

<img src="../../assets/img/bioprinting.jpg" alt="Image." width="600"/>

## Big Picture

Bioprinting in an emmergent field with the goal of 2D/3D printing living tissue for organ construction. The applications are many; mostly within medicine, eg. for organ replacement, wound healing etc. Current approaches still suffer from several consistent problems; among them, the problem of scalability, which this project attempts to tackle. The problem of scalability refers to a situation where a bioprinting technique manages to successfully reconstruct a cell scaffold of small size but fails when applied to a larger sized scaffold. The reason for this can be complex but in our case it results from high concentration of chemicals necessary for bioprinting purposes (in our case DMSO<d-footnote>Dimethyl sulfoxide</d-footnote>) but detrimental to cell viability if left for too long. To counter this problem, we hope to construct scaffolds of specific shapes that facilitate the diffusion of these harmful chemicals out of the cellular medium and into the water bath that in which the scaffold is submerged. This is where computational modeling comes in; we can model the diffusion process (using the diffusion equation PDE) for different geometries to inform the scaffold design process.

## Methods

We model the diffusion process with the time dependent diffusion equation (explained in further detail below). We then solve for the concentration spatially and over time using the finite element method (FEM). FEM can be applied to solve partial differential equations, and is especially applicable for non-typical domains (eg not square or spherical). We construct the geometric variations based on our current 3D bioprinting capabilities, define them mathematically and mesh them for FEM solving.

### Time-Dependent Diffusion Equation

The time-dependent diffusion equation describes how a quantity diffuses through space over time. It is given by:

$$
\frac{\partial u(\mathbf{x}, t)}{\partial t} = D \nabla^2 u(\mathbf{x}, t)
$$

where:
- $$u(\mathbf{x}, t)$$ is the concentration or density of the diffusing quantity at position $$ \mathbf{x} $$ and time $$t$$,
- $$D$$ is the diffusion coefficient, and
- $$\nabla^2$$ is the Laplacian operator, representing the divergence of the gradient.

This equation states that the rate of change of the concentration $$ u $$ with respect to time is proportional to the curvature of the concentration profile.

The Laplacian operator $$ \nabla^2 $$ in Cartesian coordinates is:

$$
\nabla^2 u = \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} + \frac{\partial^2 u}{\partial z^2}
$$

In cylindrical coordinates (assuming axial symmetry), it becomes:

$$
\nabla^2 u = \frac{1}{r}\frac{\partial}{\partial r}\left(r \frac{\partial u}{\partial r}\right) + \frac{1}{r^2} \frac{\partial^2 u}{\partial \theta^2} + \frac{\partial^2 u}{\partial z^2}
$$

And in spherical coordinates (assuming radial symmetry), it becomes:

$$
\nabla^2 u = \frac{1}{r^2}\frac{\partial}{\partial r}\left(r^2 \frac{\partial u}{\partial r}\right) + \frac{1}{r^2 \sin \theta} \frac{\partial}{\partial \theta}\left(\sin \theta \frac{\partial u}{\partial \theta}\right) + \frac{1}{r^2 \sin^2 \theta} \frac{\partial^2 u}{\partial \phi^2}
$$

The time-dependent diffusion equation is commonly used in various fields such as physics, chemistry, biology, and engineering to model the spreading of substances, heat, or other quantities through a medium over time.

### Finite Element Method and FEniCS

The Finite Element Method (FEM) is a numerical technique used for solving partial differential equations (PDEs) by dividing the domain into smaller, simpler subdomains called finite elements. In FEM, the solution of the PDE is approximated by piecewise polynomial functions defined over these finite elements. The method involves discretizing the domain, forming a system of algebraic equations, and then solving them to obtain the approximate solution. 

One popular tool for implementing FEM is the FEniCS Project. FEniCS is an open-source software package that provides a flexible platform for solving complex PDEs using automated finite element methods. It offers a high-level Python interface for defining and solving variational problems, allowing users to express their problems in a concise and natural mathematical language. FEniCS automates many of the tasks involved in FEM implementation, such as mesh generation, assembling stiffness matrices and load vectors, and solving linear and nonlinear systems of equations. Additionally, FEniCS comes with built-in support for parallel computing, making it suitable for solving large-scale problems efficiently.

### Geometric Construction

We want to compare different scaffold designs and in particular:

- `Cubed design` : This involves a solid cube.

- `Lattice design` : This design involves a lattice structure with space between the lattice, both side to side and top to bottom. See below Models 1 and 2:

<img src="../../assets/img/geometry.png" alt="The proposed lattice design for exploration." width="800"/>

<!-- Image borrowed from [here](https://www.google.com/url?sa=i&url=https%3A%2F%2Fbioprocessintl.com%2Fsponsored-content%2Fthe-unique-properties-of-gelatin-in-3d-bioprinting%2F&psig=AOvVaw0Xhwz15Q-vTiQSVl39Abmg&ust=1702777769004000&source=images&cd=vfe&opi=89978449&ved=0CBIQjRxqFwoTCKCQzNbrkoMDFQAAAAAdAAAAABAD). -->