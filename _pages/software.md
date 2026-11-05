---
layout: page
title: Software
permalink: /software/
description: Open tools, data and research projects from my work in computational medicine.
nav: true
nav_order: 3
---

<div class="tool-grid">
  {% for tool in site.data.software.tools %}
    <article class="tool-card">
      <div class="plate">
        <img src="{{ tool.image | relative_url }}" alt="{{ tool.alt }}" loading="lazy">
      </div>
      <div class="tool-card__body">
        <h2>{{ tool.name }}</h2>
        <p>{{ tool.text }}</p>
        <div class="work-item__links">
          {% for link in tool.links %}
            <a href="{{ link.url | relative_url }}">{{ link.label }}</a>
          {% endfor %}
        </div>
      </div>
    </article>
  {% endfor %}
</div>

<h2 class="software-heading">Extensions and utilities</h2>
<ul class="extension-list">
  {% for item in site.data.software.extensions %}
    <li>
      <a href="{{ item.url }}">{{ item.name }}</a>
      <span>{{ item.text }}</span>
    </li>
  {% endfor %}
</ul>

{% assign groups = 'lead:Research projects,collaboration:Collaborations,coursework:Coursework archive' | split: ',' %}
{% for group in groups %}
  {% assign parts = group | split: ':' %}
  {% assign projects_in_group = site.projects | where: 'category', parts[0] | sort: 'importance' %}
  <h2 class="software-heading">{{ parts[1] }}</h2>
  <div class="projects">
    <div class="row row-cols-1 row-cols-md-3">
      {% for project in projects_in_group %}
        {% include projects.liquid %}
      {% endfor %}
    </div>
  </div>
{% endfor %}
