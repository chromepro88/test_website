import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Fetch the original website
    const response = await fetch('https://bryanttan.showflat.com.sg');
    const html = await response.text();

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Find the form
    const form = document.getElementById('QueryForm');
    if (!form) {
      res.status(500).send('Form not found in original website');
      return;
    }

    // Modify form attributes
    form.setAttribute('onsubmit', 'handleFormSubmit(event)');

    // Add instance_id field
    const instanceIdInput = document.createElement('input');
    instanceIdInput.type = 'hidden';
    instanceIdInput.name = 'instance_id';
    instanceIdInput.value = '680B8789BD449';
    form.appendChild(instanceIdInput);

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      .contact-form-container { max-width: 500px; margin: 20px auto; padding: 20px; }
      .default-form2 input, .default-form2 textarea {
          width: 100%; max-width: 300px; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;
          background-color: #f8f9fa; box-sizing: border-box;
      }
      .default-form2 textarea { resize: vertical; }
      .d-flex { display: flex; }
      .align-items-center { align-items: center; }
      .justify-content-center { justify-content: center; }
      .mt-4 { margin-top: 1.5rem; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      #formToast.bg-success { background: #d4edda; border-color: #c3e6cb; }
      #formToast.bg-danger { background: #f8d7da; border-color: #f5c6cb; }
      @media (max-width: 576px) {
          .default-form2 input, .default-form2 textarea { max-width: 100%; }
      }
    `;
    document.head.appendChild(style);

    // Inject toast HTML
    const toastDiv = document.createElement('div');
    toastDiv.style.position = 'fixed';
    toastDiv.style.bottom = '10px';
    toastDiv.style.right = '10px';
    toastDiv.style.zIndex = '1050';
    toastDiv.innerHTML = `
      <div id="formToast" style="display:none;background:#fff;border:1px solid #ccc;border-radius:4px;padding:10px;">
          <div style="font-weight:bold;">Submission Status</div>
          <div id="toastBody"></div>
      </div>
    `;
    document.body.appendChild(toastDiv);

    // Modify submit button to include loader
    const submitButton = form.querySelector('#submit-contact');
    if (submitButton instanceof HTMLElement) {
      submitButton.style.cssText = 'background-color:#4e4feb;color:#ffffff;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;';
      submitButton.innerHTML = `
        <span id="contact-loader" style="display:none;border:2px solid #ffffff;border-top:2px solid transparent;border-radius:50%;width:16px;height:16px;animation:spin 1s linear infinite;margin-right:8px;"></span> Submit
      `;
    }

    // Inject JavaScript
    const script = document.createElement('script');
    script.textContent = `
      function showToast(message, isError) {
          const toast = document.getElementById('formToast');
          const toastBody = document.getElementById('toastBody');
          toastBody.textContent = message;
          toast.style.display = 'block';
          toast.className = isError ? 'bg-danger' : 'bg-success';
          setTimeout(() => { toast.style.display = 'none'; }, 5000);
      }

      async function handleFormSubmit(event) {
          event.preventDefault();
          const form = document.getElementById('QueryForm');
          const formData = new FormData(form);
          const loader = document.getElementById('contact-loader');
          const submitButton = document.getElementById('submit-contact');

          // Validation
          const email = formData.get('email');
          const phone = formData.get('phone');
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          if (!emailRegex.test(email)) {
              showToast('Please enter a valid email address.', true);
              return;
          }
          if (phone.length < 7 || phone.length > 13) {
              showToast('Phone number must be between 7 and 13 digits.', true);
              return;
          }
          if (!formData.get('instance_id')) {
              showToast('Instance ID is missing.', true);
              return;
          }

          loader.style.display = 'inline-block';
          submitButton.disabled = true;

          try {
              const formDataJson = {};
              formData.forEach((value, key) => { formDataJson[key] = value; });

              const endpoints = [
                  { url: 'https://bryanttan.showflat.com.sg/Microsite/UserMessage', body: formData, isFormData: true },
                  { url: '/api/proxy', body: JSON.stringify(formDataJson), isFormData: false }
              ];

              const responses = await Promise.all(
                  endpoints.map(async ({ url, body, isFormData }) => {
                      try {
                          const response = await fetch(url, {
                              method: 'POST',
                              body,
                              headers: isFormData ? { 'Accept': 'application/json' } : {
                                  'Content-Type': 'application/json',
                                  'Accept': 'application/json'
                              }
                          });
                          const data = await response.json();
                          return { url, status: response.status, ok: response.ok, data };
                      } catch (error) {
                          return { url, status: 'error', error };
                      }
                  })
              );

              const allSuccessful = responses.every(res => res.ok);
              if (allSuccessful) {
                  showToast('Form submitted successfully to both endpoints!');
                  form.reset();
              } else {
                  const errorMessages = responses
                      .filter(res => !res.ok)
                      .map(res => {
                          const message = res.data?.error || res.status;
                          return \`Failed to submit to \${res.url}: \${message}\${res.error ? ' - ' + res.error.message : ''}\`;
                      })
                      .join('\\n');
                  showToast('Submission issues:\\n' + errorMessages, true);
              }
          } catch (error) {
              showToast('An error occurred: ' + error.message, true);
          } finally {
              loader.style.display = 'none';
              submitButton.disabled = false;
          }
      }
    `;
    document.body.appendChild(script);

    // Ensure links point to original website
    const links = document.querySelectorAll('a[href]');
    links.forEach((link: HTMLAnchorElement) => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        link.setAttribute('href', 'https://bryanttan.showflat.com.sg' + (href.startsWith('/') ? href : '/' + href));
      }
    });

    // Add footer link to original website
    const footer = document.createElement('div');
    footer.style.textAlign = 'center';
    footer.style.marginTop = '20px';
    footer.innerHTML = '<p>Powered by <a href="https://bryanttan.showflat.com.sg">Bryant Tan</a></p>';
    document.body.appendChild(footer);

    // Serve modified HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(dom.serialize());
  } catch (error) {
    res.status(500).send('Error processing original website: ' + (error as Error).message);
  }
}
