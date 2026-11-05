---
layout: page
title: Talks
permalink: /talks/
description: Keynotes, conference presentations, workshops and other speaking.
nav: true
nav_order: 4
---

{% assign featured_talks = site.data.talks | where: "selected", true %}
{% assign other_talks = site.data.talks | where: "selected", nil %}

<h2 class="software-heading">Featured</h2>
<div class="talk-list">
  {% for talk in featured_talks %}
    {% include talk.liquid talk=talk embed=true %}
  {% endfor %}
</div>

<h2 class="software-heading">All talks and workshops</h2>
<div class="talk-list">
  {% for talk in other_talks %}
    {% include talk.liquid talk=talk %}
  {% endfor %}
</div>
