---
layout: page
title: Tools
permalink: /tools/
description: Research tools for medical images that run in your browser. Your scan stays on your computer and is never uploaded.
nav: true
nav_order: 3.5
---

{% for group in site.data.tools.groups %}
  <h2 class="software-heading">{{ group.name }}</h2>
  <div class="tool-grid">
    {% for tool in group.tools %}
      <article class="tool-card tool-card--plain">
        <div class="tool-card__body">
          <h2><a href="{{ tool.url | relative_url }}">{{ tool.name }}</a></h2>
          <p>{{ tool.text }}</p>
          <p class="tool-card__needs"><strong>You need:</strong> {{ tool.needs }}</p>
          <div class="work-item__links">
            <a href="{{ tool.url | relative_url }}">Open tool</a>
          </div>
        </div>
      </article>
    {% endfor %}
  </div>
{% endfor %}

<p class="tools-note">These are research tools. They are not for clinical use and have not been validated for diagnosis or treatment.</p>
