(() => {
  'use strict';

  // ===============================
  // FORM VALIDATION
  // ===============================

  const form = document.querySelector('.needs-validation');
  if (!form) return;
  const fields = form.querySelectorAll('.form-control');
  form.addEventListener('submit', (event) => {
    let formIsValid = true;
    fields.forEach(field => {

      // Trim spaces
      if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
        field.value = field.value.trim();
      }
      if (!field.checkValidity()) {
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        formIsValid = false;
      } else {
        field.classList.add('is-valid');
        field.classList.remove('is-invalid');
      }
    });
    
    if (!formIsValid) {
      event.preventDefault();
      event.stopPropagation();
    }
    form.classList.add('was-validated');
  });

  // Live validation
  fields.forEach(field => {
    field.addEventListener('input', () => {
      if (field.checkValidity()) {
        field.classList.add('is-valid');
        field.classList.remove('is-invalid');
      } else {
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
      }
    });
  });
})();


// ===============================
// FREEZE BUTTON AFTER CLICK
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".hk-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      this.classList.add("clicked");
    });
  });
});


// Reset on back/forward navigation
window.addEventListener("pageshow", function () {
  document.querySelectorAll(".hk-btn.clicked").forEach(btn => {
    btn.classList.remove("clicked");
  });
});


// ===============================
// AUTO CLOSE ALERTS
// ===============================

setTimeout(() => {
  const alert = document.querySelector('.auto-close');
  if (alert && window.bootstrap) {
    bootstrap.Alert.getOrCreateInstance(alert).close();
  }
}, 5000);
