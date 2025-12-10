// Simple helper to show only one panel at a time
function openPanel(id) {
  const panels = ["wherePanel", "whenPanel", "whoPanel"];
  panels.forEach(p => {
    document.getElementById(p).style.display = (p === id ? "block" : "none");
  });
}

// WHERE
const whereTrigger = document.getElementById("whereTrigger");
const wherePanel = document.getElementById("wherePanel");
const whereDisplay = document.getElementById("whereDisplay");
const whereInput = document.getElementById("whereInput");
const whereCustom = document.getElementById("whereCustom");

whereTrigger.addEventListener("click", () => openPanel("wherePanel"));

wherePanel.querySelectorAll("li").forEach(li => {
  li.addEventListener("click", () => {
    const val = li.getAttribute("data-location");
    whereDisplay.textContent = val;
    whereInput.value = val;
    openPanel(null);
  });
});

whereCustom.addEventListener("change", () => {
  if (whereCustom.value.trim() !== "") {
    whereDisplay.textContent = whereCustom.value.trim();
    whereInput.value = whereCustom.value.trim();
    openPanel(null);
  }
});

// WHEN
const whenTrigger = document.getElementById("whenTrigger");
const whenPanel = document.getElementById("whenPanel");
const whenDisplay = document.getElementById("whenDisplay");
const checkInDate = document.getElementById("checkInDate");
const checkOutDate = document.getElementById("checkOutDate");
const checkInInput = document.getElementById("checkInInput");
const checkOutInput = document.getElementById("checkOutInput");

whenTrigger.addEventListener("click", () => openPanel("whenPanel"));

document.querySelector('[data-panel="when"]').addEventListener("click", () => {
  checkInInput.value = checkInDate.value;
  checkOutInput.value = checkOutDate.value;

  if (checkInDate.value && checkOutDate.value) {
    whenDisplay.textContent = `${checkInDate.value} – ${checkOutDate.value}`;
  } else if (checkInDate.value) {
    whenDisplay.textContent = checkInDate.value;
  }

  openPanel(null);
});

// WHO (guests)
const whoTrigger = document.getElementById("whoTrigger");
const whoPanel = document.getElementById("whoPanel");
const whoDisplay = document.getElementById("whoDisplay");
const guestsInput = document.getElementById("guestsInput");

whoTrigger.addEventListener("click", () => openPanel("whoPanel"));

let guests = {
  adults: 0,
  children: 0
};

function updateGuestsDisplay() {
  const total = guests.adults + guests.children;
  guestsInput.value = total;
  whoDisplay.textContent = total > 0 ? `${total} guest${total > 1 ? "s" : ""}` : "Add guests";
}

whoPanel.querySelectorAll(".hk-guest-controls").forEach(ctrl => {
  const type = ctrl.getAttribute("data-type");
  const minus = ctrl.querySelector(".minus");
  const plus = ctrl.querySelector(".plus");
  const countSpan = ctrl.querySelector(".hk-guest-count");

  plus.addEventListener("click", () => {
    guests[type]++;
    countSpan.textContent = guests[type];
    updateGuestsDisplay();
  });

  minus.addEventListener("click", () => {
    if (guests[type] > 0) guests[type]--;
    countSpan.textContent = guests[type];
    updateGuestsDisplay();
  });
});

document.querySelector('[data-panel="who"]').addEventListener("click", () => {
  openPanel(null);
});

// Close panels when clicking outside
document.addEventListener("click", (e) => {
  const searchWrapper = document.querySelector(".hk-search-wrapper");
  if (!searchWrapper.contains(e.target)) {
    openPanel(null);
  }
});
