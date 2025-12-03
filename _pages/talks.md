---
layout: page
title: talks
permalink: /talks/
description: Conference presentations, invited talks, and other speaking engagements.
nav: true
nav_order: 3
---

<!-- pages/talks.md -->
<div class="talks">
  {%- if site.data.talks %}
    
    {%- assign selected_talks = site.data.talks | where: "selected", true %}
    {%- assign other_talks = site.data.talks | where: "selected", nil %}
    
    {%- if selected_talks.size > 0 %}
      <h2 class="selected-talks-header">Selected Talks</h2>
      {%- for talk in selected_talks %}
        <div class="talk-entry selected-talk">
          <h3>{{ talk.title }}</h3>
          <p><strong>{{ talk.venue }}</strong></p>
          <p>{{ talk.location }} • {{ talk.date }}</p>
          {%- if talk.description %}
            <p>{{ talk.description }}</p>
          {%- endif %}
          
          {%- if talk.url contains 'youtube.com' or talk.url contains 'youtu.be' %}
            {%- assign video_id = '' %}
            {%- assign start_time = '' %}
            {%- if talk.url contains 'youtube.com/watch?v=' %}
              {%- assign video_id = talk.url | split: 'v=' | last | split: '&' | first %}
              {%- if talk.url contains '&t=' %}
                {%- assign start_time = talk.url | split: '&t=' | last | split: '&' | first %}
              {%- elsif talk.url contains '?t=' %}
                {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
              {%- endif %}
            {%- elsif talk.url contains 'youtube.com/live/' %}
              {%- assign video_id = talk.url | split: '/live/' | last | split: '?' | first %}
              {%- if talk.url contains '&t=' %}
                {%- assign start_time = talk.url | split: '&t=' | last | split: '&' | first %}
              {%- elsif talk.url contains '?t=' %}
                {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
              {%- endif %}
            {%- elsif talk.url contains 'youtu.be/' %}
              {%- assign video_id = talk.url | split: 'youtu.be/' | last | split: '?' | first %}
              {%- if talk.url contains '?t=' %}
                {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
              {%- endif %}
            {%- endif %}
            
            {%- if video_id != '' %}
              <div class="youtube-embed" style="margin: 1.5rem 0;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 1rem 0;">
                  <iframe 
                    src="https://www.youtube.com/embed/{{ video_id }}{% if start_time != '' %}?start={{ start_time }}{% endif %}"
                    title="{{ talk.title }}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  </iframe>
                </div>
              </div>
            {%- endif %}
          {%- endif %}
          
          {%- if talk.url and (talk.url contains 'youtube.com' == false and talk.url contains 'youtu.be' == false) %}
            <p><a href="{{ talk.url }}" target="_blank">View slides/recording</a></p>
          {%- endif %}
        </div>
        {%- unless forloop.last %}<hr>{%- endunless %}
      {%- endfor %}
      
      {%- if other_talks.size > 0 %}
        <h2 class="other-talks-header">Other Talks</h2>
      {%- endif %}
    {%- endif %}
    
    {%- for talk in other_talks %}
      <div class="talk-entry">
        <h3>{{ talk.title }}</h3>
        <p><strong>{{ talk.venue }}</strong></p>
        <p>{{ talk.location }} • {{ talk.date }}</p>
        {%- if talk.description %}
          <p>{{ talk.description }}</p>
        {%- endif %}
        
        {%- if talk.url contains 'youtube.com' or talk.url contains 'youtu.be' %}
          {%- assign video_id = '' %}
          {%- assign start_time = '' %}
          {%- if talk.url contains 'youtube.com/watch?v=' %}
            {%- assign video_id = talk.url | split: 'v=' | last | split: '&' | first %}
            {%- if talk.url contains '&t=' %}
              {%- assign start_time = talk.url | split: '&t=' | last | split: '&' | first %}
            {%- elsif talk.url contains '?t=' %}
              {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
            {%- endif %}
          {%- elsif talk.url contains 'youtube.com/live/' %}
            {%- assign video_id = talk.url | split: '/live/' | last | split: '?' | first %}
            {%- if talk.url contains '&t=' %}
              {%- assign start_time = talk.url | split: '&t=' | last | split: '&' | first %}
            {%- elsif talk.url contains '?t=' %}
              {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
            {%- endif %}
          {%- elsif talk.url contains 'youtu.be/' %}
            {%- assign video_id = talk.url | split: 'youtu.be/' | last | split: '?' | first %}
            {%- if talk.url contains '?t=' %}
              {%- assign start_time = talk.url | split: '?t=' | last | split: '&' | first %}
            {%- endif %}
          {%- endif %}
          
          {%- if video_id != '' %}
            <div class="youtube-embed" style="margin: 1.5rem 0;">
              <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 1rem 0;">
                <iframe 
                  src="https://www.youtube.com/embed/{{ video_id }}{% if start_time != '' %}?start={{ start_time }}{% endif %}"
                  title="{{ talk.title }}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                </iframe>
              </div>
            </div>
          {%- endif %}
        {%- endif %}
        
        {%- if talk.url and (talk.url contains 'youtube.com' == false and talk.url contains 'youtu.be' == false) %}
          <p><a href="{{ talk.url }}" target="_blank">View slides/recording</a></p>
        {%- endif %}
      </div>
      {%- unless forloop.last %}<hr>{%- endunless %}
    {%- endfor %}
    
  {%- else %}
    <p>No talks available at the moment.</p>
  {%- endif %}
</div>

<style>
.selected-talks-header {
  color: var(--global-theme-color);
  border-bottom: 2px solid var(--global-theme-color);
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
  margin-top: 2rem;
}

.other-talks-header {
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  color: var(--global-text-color-light);
  border-bottom: 1px solid var(--global-divider-color);
  padding-bottom: 0.5rem;
}

.selected-talk {
  background-color: var(--global-bg-color);
  border-left: 4px solid var(--global-theme-color);
  padding-left: 1rem;
  margin-left: -1rem;
}

.talk-entry {
  margin-bottom: 1.5rem;
}

.talk-entry h3 {
  margin-bottom: 0.5rem;
  color: var(--global-text-color);
}

.talk-entry p {
  margin-bottom: 0.3rem;
}

.youtube-embed {
  margin: 1.5rem 0;
}

.youtube-embed iframe {
  transition: box-shadow 0.3s ease;
}

.youtube-embed:hover iframe {
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}

@media (max-width: 768px) {
  .youtube-embed {
    margin: 1rem 0;
  }
}

/* Remove old thumbnail styles as we're now using embeds */
.youtube-thumbnail img {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.youtube-thumbnail img:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
</style>