(() => {
  'use strict';

  // ===============================
  // FORM VALIDATION
  // ===============================
  const form = document.querySelector('.needs-validation');

  if (form) {

    const fields = form.querySelectorAll('.form-control');
    const imageInput = document.querySelector('#imageInput, #editImageInput');
    const imageError = document.querySelector('#imageError, #editImageError');
    const submitButton = form.querySelector('.hk-btn'); // Get submit button

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    form.addEventListener('submit', (event) => {

      let formIsValid = true;

      fields.forEach(field => {

        // ✅ DO NOT TOUCH FILE INPUT VALUE
        if (field.type !== "file") {
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

      // ===============================
      // FILE VALIDATION (NEW + EDIT)
      // ===============================
      if (imageInput) {

        const file = imageInput.files[0];

        imageInput.classList.remove("is-valid", "is-invalid");

        // NEW FORM → required
        if (imageInput.id === "imageInput") {

          if (!file) {
            formIsValid = false;
            imageError.textContent = "Please upload a listing image.";
            imageInput.classList.add("is-invalid");
          }
        }

        // BOTH FORMS → size check
        if (file && file.size > MAX_SIZE) {
          formIsValid = false;
          imageError.textContent = "Image must be less than 5MB.";
          imageInput.classList.add("is-invalid");
        }

        if (file && file.size <= MAX_SIZE) {
          imageInput.classList.add("is-valid");
        }
      }

      if (!formIsValid) {
        event.preventDefault();
        event.stopPropagation();
        
        // 🔥 IMPORTANT: Remove clicked class if validation fails
        if (submitButton) {
          submitButton.classList.remove('clicked');
        }
      } else {
        // ✅ Only freeze button if form is valid
        if (submitButton) {
          submitButton.classList.add('clicked');
        }
      }

      form.classList.add('was-validated');
    });

    // ===============================
    // LIVE VALIDATION
    // ===============================
    fields.forEach(field => {

      field.addEventListener('input', () => {

        if (field.type === "file") return; // 🔥 ignore file input

        if (field.checkValidity()) {
          field.classList.add('is-valid');
          field.classList.remove('is-invalid');
        } else {
          field.classList.add('is-invalid');
          field.classList.remove('is-valid');
        }
      });

    });

    // ===============================
    // FILE LIVE VALIDATION
    // ===============================
    if (imageInput) {
      imageInput.addEventListener("change", () => {

        const file = imageInput.files[0];

        imageInput.classList.remove("is-valid", "is-invalid");

        if (!file) return;

        if (file.size > MAX_SIZE) {
          imageError.textContent = "Image must be less than 5MB.";
          imageInput.classList.add("is-invalid");
        } else {
          imageInput.classList.add("is-valid");
        }
      });
    }

  }

  // ===============================
  // REMOVE BUTTON FREEZE CODE (Not needed anymore)
  // ===============================
  // Commented out - now handled in form submit event
  /*
  document.querySelectorAll(".hk-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      this.classList.add("clicked");
    });
  });
  */

  window.addEventListener("pageshow", () => {
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

})();