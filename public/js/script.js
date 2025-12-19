(() => {
  'use strict';

  const form = document.querySelector('.needs-validation');
  if (!form) return; // safety check

  const fields = form.querySelectorAll('.form-control');

  // SUBMIT VALIDATION (force red ❌ on all invalid fields)
  form.addEventListener('submit', (event) => {
    let formIsValid = true;

    fields.forEach(field => {
      // trim text inputs & textarea (avoid space-only cheating)
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

  // REAL-TIME VALIDATION (while typing)
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
