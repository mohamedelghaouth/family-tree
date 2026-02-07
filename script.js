// =============================================
// MAIN APPLICATION
// Family Tree with Local Storage
// =============================================

// Load data from storage or use initial data
let allPersons = Storage.load() || { ...initialFamilyData };
let currentRootId = "p1";
let selectedNodeId = null;
let currentAction = null;
let expandedNodes = new Set(); // Track which nodes are expanded
let targetPersonId = null; // Track the person to show path to
let nodeOffsets = {}; // Store manual position adjustments { personId: { dx, dy } }
let currentView = "home"; // "home" or "tree"

// Save data whenever it changes
function saveData() {
  Storage.save(allPersons);
}

// Initialize the app
function init() {
  Tree.init();
  targetPersonId = null; // Clear target on init
  currentView = "home"; // Start with family overview

  // Set initial history state
  history.replaceState({ view: "home" }, "", "#home");

  render();
  setupEventListeners();
  setupHistoryNavigation();

  // Auto-save every 30 seconds
  setInterval(saveData, 30000);
}

// Main render function
function render() {
  if (currentView === "home") {
    renderFamilyOverview();
  } else {
    renderTree();
  }
}

// Render the tree
function renderTree() {
  Tree.render(
    currentRootId,
    allPersons,
    selectedNodeId,
    expandedNodes,
    targetPersonId,
    nodeOffsets,
    updateNodeOffset,
    selectNode,
    showContextMenu,
    navigateToPersonTree,
    toggleExpand,
  );
}

// Update node offset when dragged
function updateNodeOffset(personId, dx, dy) {
  if (!nodeOffsets[personId]) {
    nodeOffsets[personId] = { dx: 0, dy: 0 };
  }
  nodeOffsets[personId].dx += dx;
  nodeOffsets[personId].dy += dy;
}

// Toggle expand/collapse a node
function toggleExpand(personId) {
  if (expandedNodes.has(personId)) {
    expandedNodes.delete(personId);
  } else {
    expandedNodes.add(personId);
    // Clear target when manually expanding to show all branches
    targetPersonId = null;
  }
  renderTree();
}

// Get all root families (unique patriarchs based on familyId)
function getRootFamilies() {
  const familyMap = new Map();

  // Collect unique family patriarchs
  Object.values(allPersons).forEach((person) => {
    if (person.familyId && !familyMap.has(person.familyId)) {
      // Find the patriarch: the person whose id equals the familyId
      const patriarch = allPersons[person.familyId];
      if (patriarch) {
        familyMap.set(person.familyId, patriarch);
      }
    }
  });

  return Array.from(familyMap.values());
}

// Get family surname from person's name
function getFamilySurname(name) {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// Render family overview (home page with family cards)
function renderFamilyOverview() {
  const treeContainer = document.getElementById("tree-container");
  const familyView = document.getElementById("family-view");
  const homeBtn = document.getElementById("home-btn");

  treeContainer.style.display = "none";
  familyView.style.display = "flex";
  homeBtn.style.display = "none";

  const roots = getRootFamilies();

  familyView.innerHTML = roots
    .map((person) => {
      const familyName = `عائلة ${person.name}`;

      return `
      <div class="family-card" data-person-id="${person.id}">
        <div class="family-card-icon">👨‍👩‍👧‍👦</div>
        <h3>${familyName}</h3>
        <p class="family-members">${getDescendantCount(person.id)} أفراد</p>
      </div>
    `;
    })
    .join("");

  // Add click handlers - make entire card clickable
  document.querySelectorAll(".family-card").forEach((card) => {
    card.addEventListener("click", () => {
      const personId = card.dataset.personId;
      showFamilyTree(personId);
    });
  });
}

// Get total descendant count
function getDescendantCount(personId) {
  const visited = new Set();

  function count(id) {
    if (visited.has(id)) return 0;
    visited.add(id);

    const person = allPersons[id];
    if (!person) return 0;

    let total = 1;
    if (person.childrenIds) {
      person.childrenIds.forEach((childId) => {
        total += count(childId);
      });
    }
    return total;
  }

  return count(personId);
}

// Show a specific family tree
function showFamilyTree(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Find the true root (highest ancestor)
  let rootId = personId;
  let current = person;

  // Traverse up to find the highest ancestor (no parents)
  while (current.fatherId || current.motherId) {
    rootId = current.fatherId || current.motherId;
    current = allPersons[rootId];
    if (!current) break;
  }

  currentView = "tree";
  currentRootId = rootId;
  targetPersonId = null;
  expandedNodes.clear();

  // Expand from root down to the family patriarch
  if (rootId !== personId) {
    // Expand path from root to the clicked person
    const pathToPatriarch = getPathToTarget(rootId, personId);
    pathToPatriarch.forEach((id) => expandedNodes.add(id));
  } else {
    expandedNodes.add(personId);
  }

  nodeOffsets = {};

  // Push state to history
  history.pushState(
    {
      view: "tree",
      rootId: rootId,
      targetPersonId: personId !== rootId ? personId : null,
    },
    "",
    `#tree/${rootId}${personId !== rootId ? "/" + personId : ""}`,
  );

  const treeContainer = document.getElementById("tree-container");
  const familyView = document.getElementById("family-view");
  const homeBtn = document.getElementById("home-btn");

  treeContainer.style.display = "block";
  familyView.style.display = "none";
  homeBtn.style.display = "inline-flex";

  // Center the view before rendering the new tree
  Tree.centerView();
  renderTree();

  // Highlight the family patriarch if different from root
  if (personId !== rootId) {
    setTimeout(() => Tree.highlightPerson(personId), 100);
  }
}

// Go back to family overview
function goHome() {
  currentView = "home";

  // Push state to history
  history.pushState({ view: "home" }, "", "#home");

  render();
}

// Navigate to a person's tree (show only path to this person)
function navigateToPersonTree(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Find the root of this person's family tree
  let rootId = personId;
  let current = person;

  // Traverse up to find the patriarch/matriarch (no parents)
  while (current.fatherId || current.motherId) {
    rootId = current.fatherId || current.motherId;
    current = allPersons[rootId];
    if (!current) break;
  }

  currentView = "tree";
  currentRootId = rootId;
  targetPersonId = personId; // Set target to show path
  expandedNodes.clear();
  nodeOffsets = {}; // Clear offsets when switching trees

  // Push state to history
  history.pushState(
    { view: "tree", rootId: rootId, targetPersonId: personId },
    "",
    `#tree/${rootId}/${personId}`,
  );

  // Auto-expand the path to the target person
  const pathToTarget = getPathToTarget(rootId, personId);
  pathToTarget.forEach((id) => expandedNodes.add(id));

  // Update UI visibility
  const treeContainer = document.getElementById("tree-container");
  const familyView = document.getElementById("family-view");
  const homeBtn = document.getElementById("home-btn");

  treeContainer.style.display = "block";
  familyView.style.display = "none";
  homeBtn.style.display = "inline-flex";

  // Center the view before rendering the tree
  Tree.centerView();
  renderTree();
  setTimeout(() => Tree.highlightPerson(personId), 100);
}

// Setup browser history navigation (back/forward buttons)
function setupHistoryNavigation() {
  window.addEventListener("popstate", (event) => {
    if (event.state) {
      const { view, rootId, targetPersonId: target } = event.state;

      if (view === "home") {
        currentView = "home";
        render();
      } else if (view === "tree") {
        currentView = "tree";
        currentRootId = rootId;
        targetPersonId = target || null;

        // Restore tree state
        if (target) {
          const pathToTarget = getPathToTarget(rootId, target);
          expandedNodes.clear();
          pathToTarget.forEach((id) => expandedNodes.add(id));
        } else {
          expandedNodes.clear();
          expandedNodes.add(rootId);
        }

        // Update UI
        const treeContainer = document.getElementById("tree-container");
        const familyView = document.getElementById("family-view");
        const homeBtn = document.getElementById("home-btn");

        treeContainer.style.display = "block";
        familyView.style.display = "none";
        homeBtn.style.display = "inline-flex";

        // Center the view when navigating via browser history
        Tree.centerView();
        renderTree();
        if (target) {
          setTimeout(() => Tree.highlightPerson(target), 100);
        }
      }
    }
  });
}

// Get path from root to target person
function getPathToTarget(rootId, targetId) {
  const path = [];
  const visited = new Set();

  function findPath(currentId) {
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    if (currentId === targetId) {
      path.push(currentId);
      return true;
    }

    const person = allPersons[currentId];
    if (!person || !person.childrenIds) return false;

    for (const childId of person.childrenIds) {
      if (findPath(childId)) {
        path.push(currentId);
        return true;
      }
    }

    return false;
  }

  findPath(rootId);
  return path.reverse();
}

// Select a node
function selectNode(node) {
  selectedNodeId = node.data.id;
  renderTree();
}

// =============================================
// CONTEXT MENU
// =============================================
const contextMenu = document.getElementById("context-menu");

function showContextMenu(event, node) {
  selectedNodeId = node.data.id;

  contextMenu.style.display = "block";
  contextMenu.style.left = event.pageX + "px";
  contextMenu.style.top = event.pageY + "px";

  // Update button actions
  document.getElementById("ctx-add-child").onclick = () => {
    hideContextMenu();
    openModal("add-child", node.data);
  };

  document.getElementById("ctx-edit").onclick = () => {
    hideContextMenu();
    openModal("edit", node.data);
  };

  document.getElementById("ctx-make-family").onclick = () => {
    hideContextMenu();
    if (
      confirm(
        `هل تريد جعل ${node.data.name} رأس عائلة جديدة؟\n\nسيتم تحديث ${node.data.name} وجميع الأفراد لينتموا لهذه العائلة الجديدة.`,
      )
    ) {
      makePersonFamilyRoot(node.data.id);
    }
  };

  document.getElementById("ctx-remove-family").onclick = () => {
    hideContextMenu();
    const person = allPersons[node.data.id];
    const message = person.fatherId
      ? `إزالة ${node.data.name} كرأس عائلة؟\n\nسيعود هو وأفراده إلى عائلة الوالد.`
      : `إزالة ${node.data.name} كرأس عائلة؟\n\nلن يكون له ولأفراده انتماء عائلي.`;
    if (confirm(message)) {
      removePersonAsFamilyRoot(node.data.id);
    }
  };

  document.getElementById("ctx-delete").onclick = () => {
    hideContextMenu();
    if (confirm(`حذف ${node.data.name}؟`)) {
      deletePerson(node.data.id);
    }
  };
}

function hideContextMenu() {
  contextMenu.style.display = "none";
}

// =============================================
// MODAL
// =============================================
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const personForm = document.getElementById("person-form");

function openModal(action, person = null) {
  currentAction = action;
  selectedSpouseId = null; // Reset selected spouse

  if (action === "add-root") {
    modalTitle.textContent = "إضافة شخص جديد";
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value = "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-spouse").value = "";
    document.getElementById("input-info").value = "";
    document.getElementById("input-is-head").checked = true;
    // Store info in data attributes - no parents
    personForm.dataset.fatherId = "";
    personForm.dataset.motherId = "";
    personForm.dataset.personId = generateId();
  } else if (action === "add-child") {
    modalTitle.textContent = `إضافة طفل لـ ${person.name}`;
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value = "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-spouse").value = "";
    document.getElementById("input-info").value = "";
    document.getElementById("input-is-head").checked = false;
    // Store parent info in data attributes
    personForm.dataset.fatherId = person.id;
    personForm.dataset.motherId = person.spouseId || "";
    personForm.dataset.personId = generateId();
  } else if (action === "edit") {
    modalTitle.textContent = `تعديل ${person.name}`;
    document.getElementById("input-name").value = person.name;
    document.getElementById("input-gender").value = person.gender || "male";
    document.getElementById("input-dates").value = person.dates || "";
    document.getElementById("input-spouse").value = person.spouseId
      ? allPersons[person.spouseId]?.name || ""
      : "";
    document.getElementById("input-info").value = person.info || "";
    document.getElementById("input-is-head").checked =
      person.familyId === person.id;
    // Store person info in data attributes
    personForm.dataset.personId = person.id;
    personForm.dataset.fatherId = person.fatherId || "";
    personForm.dataset.motherId = person.motherId || "";
    personForm.dataset.spouseId = person.spouseId || "";
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  personForm.reset();
}

// =============================================
// CRUD OPERATIONS
// =============================================

function generateId() {
  let maxId = 0;
  Object.keys(allPersons).forEach((key) => {
    const num = parseInt(key.substring(1));
    if (num > maxId) maxId = num;
  });
  return `p${maxId + 1}`;
}

function addOrEditPerson(event) {
  event.preventDefault();

  const id = personForm.dataset.personId;
  const name = document.getElementById("input-name").value;
  const gender = document.getElementById("input-gender").value;
  const dates = document.getElementById("input-dates").value;
  const spouseName = document.getElementById("input-spouse").value;
  const fatherId = personForm.dataset.fatherId;
  const motherId = personForm.dataset.motherId;
  const info = document.getElementById("input-info").value;
  const isHeadOfFamily = document.getElementById("input-is-head").checked;

  const personData = { id, name, gender, dates };
  if (fatherId) personData.fatherId = fatherId;
  if (motherId) personData.motherId = motherId;
  if (info) personData.info = info;

  // Set familyId
  if (isHeadOfFamily) {
    // Person is head of their own family
    personData.familyId = id;

    // Update all descendants to belong to this family
    if (currentAction === "edit" && allPersons[id]) {
      function updateDescendants(personId) {
        const current = allPersons[personId];
        if (!current || !current.childrenIds) return;

        current.childrenIds.forEach((childId) => {
          const child = allPersons[childId];
          if (child) {
            child.familyId = id;
            updateDescendants(childId);
          }
        });
      }
      updateDescendants(id);
    }
  } else if (currentAction === "add-root") {
    // If not head and adding root, still set as their own patriarch
    personData.familyId = id;
  } else if (currentAction === "add-child") {
    // Child inherits familyId from father, or mother if no father
    if (fatherId && allPersons[fatherId]) {
      personData.familyId = allPersons[fatherId].familyId;
    } else if (motherId && allPersons[motherId]) {
      personData.familyId = allPersons[motherId].familyId;
    }
  } else if (currentAction === "edit" && allPersons[id]) {
    // If not head, inherit from parent or keep existing
    if (fatherId && allPersons[fatherId]) {
      personData.familyId = allPersons[fatherId].familyId;
    } else if (motherId && allPersons[motherId]) {
      personData.familyId = allPersons[motherId].familyId;
    } else {
      personData.familyId = allPersons[id].familyId;
    }
  }

  // Handle spouse
  if (currentAction === "edit" && personForm.dataset.spouseId) {
    personData.spouseId = personForm.dataset.spouseId;
    // Update spouse name if changed
    if (spouseName && allPersons[personForm.dataset.spouseId]) {
      allPersons[personForm.dataset.spouseId].name = spouseName;
    }
  } else if (
    spouseName &&
    (currentAction === "add-child" || currentAction === "add-root")
  ) {
    // Check if a spouse was selected from suggestions
    if (selectedSpouseId && allPersons[selectedSpouseId]) {
      // Use existing person as spouse
      personData.spouseId = selectedSpouseId;
      // Update the existing spouse's spouseId to link back
      allPersons[selectedSpouseId].spouseId = id;
      // Sync children lists
      if (!allPersons[selectedSpouseId].childrenIds) {
        allPersons[selectedSpouseId].childrenIds = [];
      }
    } else {
      // Create new spouse for new person
      const spouseId = generateId();
      const spouseGender = gender === "male" ? "female" : "male"; // Opposite gender
      const spouse = {
        id: spouseId,
        name: spouseName,
        gender: spouseGender,
        familyId: spouseId, // Spouse is their own family patriarch (we don't know their parents)
        spouseId: id,
        childrenIds: [],
      };
      allPersons[spouseId] = spouse;
      personData.spouseId = spouseId;
    }
  }

  if (currentAction === "add-child" || currentAction === "add-root") {
    personData.childrenIds = [];
    allPersons[id] = personData;

    // Add to parent's children (only if adding child, not root)
    if (currentAction === "add-child") {
      if (fatherId && allPersons[fatherId]) {
        if (!allPersons[fatherId].childrenIds)
          allPersons[fatherId].childrenIds = [];
        allPersons[fatherId].childrenIds.push(id);
      }
      if (motherId && allPersons[motherId]) {
        if (!allPersons[motherId].childrenIds)
          allPersons[motherId].childrenIds = [];
        allPersons[motherId].childrenIds.push(id);
      }
    } else if (currentAction === "add-root") {
      // When adding a root person, check current view
      if (currentView === "home") {
        // Stay on home view and refresh to show new family
        currentView = "home";
      } else {
        // Show their tree if we're already in tree view
        currentView = "tree";
        currentRootId = id;
        expandedNodes.clear();
        expandedNodes.add(id);
      }
    }
  } else if (currentAction === "edit") {
    // Preserve childrenIds
    personData.childrenIds = allPersons[id].childrenIds || [];
    allPersons[id] = personData;
  }

  saveData();
  closeModal();
  render();
}

function deletePerson(personId) {
  // Remove from parents' childrenIds
  const person = allPersons[personId];
  if (person.fatherId && allPersons[person.fatherId]) {
    allPersons[person.fatherId].childrenIds = allPersons[
      person.fatherId
    ].childrenIds.filter((id) => id !== personId);
  }
  if (person.motherId && allPersons[person.motherId]) {
    allPersons[person.motherId].childrenIds = allPersons[
      person.motherId
    ].childrenIds.filter((id) => id !== personId);
  }

  // Delete person
  delete allPersons[personId];

  // If it's the current root, go back to p1
  if (currentRootId === personId) {
    currentRootId = "p1";
  }

  saveData();
  render();
}

// Make a person the root of their own family
function makePersonFamilyRoot(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Set this person as their own family patriarch
  person.familyId = personId;

  // Update all descendants to belong to this family
  function updateDescendants(id) {
    const current = allPersons[id];
    if (!current || !current.childrenIds) return;

    current.childrenIds.forEach((childId) => {
      const child = allPersons[childId];
      if (child) {
        child.familyId = personId;
        updateDescendants(childId); // Recursively update grandchildren
      }
    });
  }

  updateDescendants(personId);

  saveData();
  render();
  alert(
    `${person.name} أصبح رأس عائلة جديدة!\n\nتم تحديث جميع الأفراد لينتموا لهذه العائلة.`,
  );
}

// Remove a person as family root (revert to parent's family or no family)
function removePersonAsFamilyRoot(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Determine the new family ID
  let newFamilyId = null;

  if (person.fatherId && allPersons[person.fatherId]) {
    // Inherit father's familyId
    newFamilyId = allPersons[person.fatherId].familyId;
  } else if (person.motherId && allPersons[person.motherId]) {
    // Or mother's familyId if no father
    newFamilyId = allPersons[person.motherId].familyId;
  }
  // If no parents, newFamilyId stays null

  // Update this person
  if (newFamilyId) {
    person.familyId = newFamilyId;
  } else {
    delete person.familyId;
  }

  // Update all descendants to the same familyId
  function updateDescendants(id) {
    const current = allPersons[id];
    if (!current || !current.childrenIds) return;

    current.childrenIds.forEach((childId) => {
      const child = allPersons[childId];
      if (child) {
        if (newFamilyId) {
          child.familyId = newFamilyId;
        } else {
          delete child.familyId;
        }
        updateDescendants(childId); // Recursively update grandchildren
      }
    });
  }

  updateDescendants(personId);

  saveData();
  render();

  if (newFamilyId) {
    const patriarch = allPersons[newFamilyId];
    alert(`تم إرجاع ${person.name} وأفراده إلى عائلة ${patriarch.name}.`);
  } else {
    alert(`${person.name} وأفراده لم يعودوا لهم انتماء عائلي.`);
  }
}

// =============================================
// SEARCH
// =============================================
const searchInput = document.getElementById("search");
const searchSuggestions = document.getElementById("search-suggestions");
const spouseInput = document.getElementById("input-spouse");
const spouseSuggestions = document.getElementById("spouse-suggestions");
let selectedSpouseId = null; // Track if a spouse was selected from suggestions

function showSearchSuggestions() {
  const query = searchInput.value.toLowerCase().trim();

  if (!query) {
    searchSuggestions.classList.remove("show");
    return;
  }

  const results = Object.values(allPersons)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.dates && p.dates.toLowerCase().includes(query)),
    )
    .slice(0, 8); // Limit to 8 suggestions

  if (results.length === 0) {
    searchSuggestions.classList.remove("show");
    return;
  }

  searchSuggestions.innerHTML = results
    .map((person) => {
      const patriarch = allPersons[person.familyId];
      const familyName = patriarch
        ? `عائلة ${patriarch.name}`
        : `عائلة ${person.name}`;
      return `
        <div class="search-suggestion-item" data-person-id="${person.id}">
          <div class="search-suggestion-name">${person.name}</div>
          <div class="search-suggestion-family">${familyName} ${person.dates ? "• " + person.dates : ""}</div>
        </div>
      `;
    })
    .join("");

  // Add click handlers
  searchSuggestions
    .querySelectorAll(".search-suggestion-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const personId = item.dataset.personId;
        navigateToPersonTree(personId);
        searchInput.value = "";
        searchSuggestions.classList.remove("show");
      });
    });

  searchSuggestions.classList.add("show");
}

function searchPerson() {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return;

  const results = Object.values(allPersons).filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      (p.dates && p.dates.toLowerCase().includes(query)),
  );

  if (results.length > 0) {
    navigateToPersonTree(results[0].id);
    searchInput.value = "";
    searchSuggestions.classList.remove("show");
  } else {
    alert("لم يتم العثور على الشخص");
  }
}

function showSpouseSuggestions() {
  const query = spouseInput.value.toLowerCase().trim();

  // Clear selected spouse when typing
  selectedSpouseId = null;

  if (!query) {
    spouseSuggestions.classList.remove("show");
    return;
  }

  const results = Object.values(allPersons)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.dates && p.dates.toLowerCase().includes(query)),
    )
    .slice(0, 6); // Limit to 6 suggestions

  if (results.length === 0) {
    spouseSuggestions.classList.remove("show");
    return;
  }

  spouseSuggestions.innerHTML = results
    .map((person) => {
      const patriarch = allPersons[person.familyId];
      const familyName = patriarch
        ? `عائلة ${patriarch.name}`
        : `عائلة ${person.name}`;
      return `
        <div class="spouse-suggestion-item" data-person-id="${person.id}">
          <div class="spouse-suggestion-name">${person.name}</div>
          <div class="spouse-suggestion-family">${familyName} ${person.dates ? "• " + person.dates : ""}</div>
        </div>
      `;
    })
    .join("");

  // Add click handlers
  spouseSuggestions
    .querySelectorAll(".spouse-suggestion-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const personId = item.dataset.personId;
        const person = allPersons[personId];
        spouseInput.value = person.name;
        selectedSpouseId = personId; // Store the selected spouse ID
        spouseSuggestions.classList.remove("show");
      });
    });

  spouseSuggestions.classList.add("show");
}

// =============================================
// EVENT LISTENERS
// =============================================
function setupEventListeners() {
  // Burger Menu
  const burgerBtn = document.getElementById("burger-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileOverlay = document.getElementById("mobile-overlay");
  const mobileHomeBtn = document.getElementById("mobile-home-btn");

  function toggleMobileMenu() {
    burgerBtn.classList.toggle("active");
    mobileMenu.classList.toggle("open");
    mobileOverlay.classList.toggle("show");
  }

  function closeMobileMenu() {
    burgerBtn.classList.remove("active");
    mobileMenu.classList.remove("open");
    mobileOverlay.classList.remove("show");
  }

  burgerBtn.addEventListener("click", toggleMobileMenu);
  mobileOverlay.addEventListener("click", closeMobileMenu);

  // Close mobile menu on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    }
  });

  // Mobile menu buttons - mirror desktop buttons
  document.getElementById("mobile-add-btn").addEventListener("click", () => {
    closeMobileMenu();
    openModal("add-root");
  });

  document.getElementById("mobile-export-btn").addEventListener("click", () => {
    closeMobileMenu();
    Storage.exportToFile(allPersons);
  });

  document.getElementById("mobile-import-btn").addEventListener("click", () => {
    closeMobileMenu();
    document.getElementById("import-file").click();
  });

  document.getElementById("mobile-clear-btn").addEventListener("click", () => {
    closeMobileMenu();
    if (
      confirm(
        "هل أنت متأكد من مسح جميع البيانات؟ سيتم إعادة تعيين شجرة العائلة الافتراضية.",
      )
    ) {
      Storage.clear();
      allPersons = { ...initialFamilyData };
      saveData();
      currentRootId = "p1";
      currentView = "home";
      render();
      alert("تم مسح البيانات وإعادة التعيين بنجاح!");
    }
  });

  mobileHomeBtn.addEventListener("click", () => {
    closeMobileMenu();
    goHome();
  });

  // Sync mobile home button visibility with desktop home button
  const homeBtn = document.getElementById("home-btn");
  const observer = new MutationObserver(() => {
    mobileHomeBtn.style.display = homeBtn.style.display;
  });
  observer.observe(homeBtn, { attributes: true, attributeFilter: ["style"] });

  // Search
  searchInput.addEventListener("input", showSearchSuggestions);

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchPerson();
  });

  // Spouse suggestions
  spouseInput.addEventListener("input", showSpouseSuggestions);

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      searchSuggestions.classList.remove("show");
    }
    if (!e.target.closest(".spouse-input-container")) {
      spouseSuggestions.classList.remove("show");
    }
  });

  // Modal close button
  document.getElementById("close-modal").onclick = closeModal;

  // Modal cancel button
  document.getElementById("cancel-btn").onclick = closeModal;

  // Form submit
  personForm.onsubmit = addOrEditPerson;

  // Add root person button
  document.getElementById("add-root-btn").onclick = () => {
    openModal("add-root");
  };

  // Home button
  document.getElementById("home-btn").onclick = goHome;

  // Export data
  document.getElementById("export-btn").onclick = () => {
    Storage.exportToFile(allPersons);
  };

  // Import data
  document.getElementById("import-btn").onclick = () => {
    document.getElementById("import-file").click();
  };

  document.getElementById("import-file").onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      Storage.importFromFile(file, (data) => {
        allPersons = data;
        saveData();
        currentView = "home";
        render();
        alert("تم استيراد البيانات بنجاح!");
      });
    }
  };

  // Clear data
  document.getElementById("clear-btn").onclick = () => {
    if (
      confirm(
        "هل أنت متأكد من مسح جميع البيانات؟ سيتم إعادة تعيين شجرة العائلة الافتراضية.",
      )
    ) {
      Storage.clear();
      allPersons = { ...initialFamilyData };
      saveData();
      currentRootId = "p1";
      currentView = "home";
      render();
      alert("تم مسح البيانات وإعادة التعيين بنجاح!");
    }
  };

  // Click outside to close
  window.onclick = (event) => {
    if (event.target === modal) closeModal();
    hideContextMenu();
  };

  // Prevent context menu on SVG
  document.getElementById("tree-svg").addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Handle window resize to update tree dimensions
  window.addEventListener("resize", () => {
    if (currentView === "tree") {
      Tree.updateDimensions();
    }
  });
}

// =============================================
// INITIALIZE
// =============================================
init();
