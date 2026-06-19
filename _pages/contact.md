---
layout: page
title: contact
permalink: /contact/
description: Get in touch for collaborations, questions, or opportunities.
nav: true
nav_order: 7
---

## Get in Touch

I welcome inquiries about research collaborations, speaking opportunities, and discussions about computational medicine, cardiovascular modeling, and AI-driven healthcare solutions. Whether you're a fellow researcher, clinician, student, or industry professional, I'm always interested in connecting and exploring how we can work together to advance translational research.

Please fill out the form below, and I'll get back to you as soon as possible.

---

## Contact Form

<div class="contact-form-container">
  <form 
    id="contact-form" 
    action="https://formspree.io/f/xzdznyqv" 
    method="POST"
    class="contact-form"
  >
    <div class="form-group">
      <label for="name">Name <span class="required">*</span></label>
      <input 
        type="text" 
        id="name" 
        name="name" 
        class="form-control" 
        placeholder="Your name"
        required
      >
    </div>

    <div class="form-group">
      <label for="email">Email <span class="required">*</span></label>
      <input
        type="email"
        id="email"
        name="email"
        class="form-control"
        placeholder="your.email@example.com"
        required
      >
    </div>

    <div class="form-group">
      <label for="message">Message <span class="required">*</span></label>
      <textarea
        id="message"
        name="message"
        class="form-control"
        rows="6"
        placeholder="Your message..."
        required
      ></textarea>
    </div>

    <!-- Honeypot for spam protection -->
    <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">

    <input type="hidden" name="_subject" value="New Contact Form Submission from numisveinsson.com">
    <input type="hidden" name="_next" value="{{ site.url }}/contact/?submitted=true">
    <input type="hidden" name="_format" value="plain">
    <input type="hidden" name="_replyto" value="" id="replyto-field">

    <div class="form-group">
      <button type="submit" class="btn btn-primary btn-submit" id="submit-btn">
        <span class="btn-text">Send Message</span>
        <span class="btn-loading" style="display: none;">Sending...</span>
      </button>
    </div>

    <!-- Success Message -->
    <div id="form-success" class="alert alert-success" style="display: none;">
      <strong>Thank you!</strong> Your message has been sent successfully. I'll get back to you within 2-3 business days.
    </div>

    <!-- Error Message -->
    <div id="form-error" class="alert alert-danger" style="display: none;">
      <strong>Error:</strong> There was a problem sending your message. Please try again or email me directly at <a href="mailto:numi@utexas.edu">numi@utexas.edu</a>.
    </div>

  </form>
</div>

<style>
.contact-form-container {
  max-width: 700px;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--global-bg-color);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: var(--global-text-color);
  font-size: 0.95rem;
}

.required {
  color: #dc3545;
}

.form-control {
  padding: 0.75rem;
  border: 1px solid var(--global-divider-color);
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  background-color: var(--global-bg-color);
  color: var(--global-text-color);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--global-theme-color);
  box-shadow: 0 0 0 2px rgba(var(--global-theme-color-rgb), 0.2);
}

.form-control::placeholder {
  color: var(--global-text-color);
  opacity: 0.6;
}

select.form-control {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

textarea.form-control {
  resize: vertical;
  min-height: 150px;
  font-family: inherit;
}

.btn-submit {
  padding: 0.875rem 2rem;
  background-color: var(--global-theme-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  align-self: flex-start;
  min-width: 150px;
}

.btn-submit:hover {
  background-color: var(--global-hover-color);
  transform: translateY(-1px);
}

.btn-submit:active {
  transform: translateY(0);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.alert-success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.alert-danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.alert a {
  color: inherit;
  text-decoration: underline;
}

@media (max-width: 768px) {
  .contact-form-container {
    padding: 1rem;
  }
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  const successMsg = document.getElementById('form-success');
  const errorMsg = document.getElementById('form-error');

  // Check if form was submitted successfully (from URL parameter)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('submitted') === 'true') {
    successMsg.style.display = 'block';
    form.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Hide previous messages
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    // Set reply-to email for easy responses
    const emailField = document.getElementById('email');
    const replytoField = document.getElementById('replyto-field');
    if (emailField && replytoField) {
      replytoField.value = emailField.value;
    }
    
    // Submit form
    const formData = new FormData(form);
    
    fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        // Success
        form.reset();
        successMsg.style.display = 'block';
        form.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Error
        errorMsg.style.display = 'block';
        throw new Error('Form submission failed');
      }
    })
    .catch(error => {
      errorMsg.style.display = 'block';
      console.error('Error:', error);
    })
    .finally(() => {
      // Reset button state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    });
  });
});
</script>

---

## Alternative Contact Methods

### Direct Email

**Primary:** [numi@utexas.edu](mailto:numi@utexas.edu)

### Office Location

**Center for Computational Medicine**  
Oden Institute for Computational Engineering and Sciences  
University of Texas at Austin  
Austin, Texas, USA

---
