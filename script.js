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
    // Store the expanded node to auto-scroll after render
    window.lastExpandedNodeId = personId;
  }
  renderTree();

  // Auto-scroll to show children after a short delay (let DOM update)
  if (window.lastExpandedNodeId) {
    setTimeout(() => {
      Tree.scrollToShowChildren(window.lastExpandedNodeId);
      window.lastExpandedNodeId = null;
    }, 100);
  }
}

// Get all root families (unique patriarchs based on familyId)
function getRootFamilies() {
  // Return persons whose id equals their familyId (true family patriarchs)
  return Object.values(allPersons).filter(
    (person) => person.familyId && person.id === person.familyId,
  );
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

  let roots = getRootFamilies();
  // Sort by number of persons (desc)
  roots = roots
    .map((person) => ({
      person,
      count: getDescendantCount(person.id),
    }))
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.person);

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

  // Use the family patriarch as root (person whose familyId equals their id)
  // Don't traverse up to parents - only show the family downward from the patriarch
  let rootId = person.familyId || personId;

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

  // Use the family patriarch as root, not the highest ancestor
  // This ensures we only show the family tree, not their parents
  let rootId = person.familyId || personId;

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

// Show person with their parents (traverse up to show ancestry)
function showPersonWithParents(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Find the highest ancestor by traversing up
  let rootId = personId;
  let current = person;

  while (current.fatherId || current.motherId) {
    rootId = current.fatherId || current.motherId;
    current = allPersons[rootId];
    if (!current) break;
  }

  currentView = "tree";
  currentRootId = rootId;
  targetPersonId = personId;
  expandedNodes.clear();
  nodeOffsets = {};

  // Push state to history
  history.pushState(
    { view: "tree", rootId: rootId, targetPersonId: personId },
    "",
    `#tree/${rootId}/${personId}`,
  );

  // Auto-expand the path from highest ancestor to the person
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

  // Position menu initially to measure its size
  contextMenu.style.left = "0px";
  contextMenu.style.top = "0px";

  // Get menu dimensions
  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate position
  let left = event.pageX;
  let top = event.pageY;

  // Adjust if menu would go off right edge
  if (left + menuWidth > viewportWidth) {
    left = viewportWidth - menuWidth - 10;
  }

  // Adjust if menu would go off bottom edge
  if (top + menuHeight > viewportHeight + window.scrollY) {
    top = event.pageY - menuHeight;
    // If still off-screen, position at bottom with some padding
    if (top < window.scrollY) {
      top = viewportHeight + window.scrollY - menuHeight - 10;
    }
  }

  contextMenu.style.left = left + "px";
  contextMenu.style.top = top + "px";

  // Show/hide "Show Parents" button based on whether person has parents
  const showParentsBtn = document.getElementById("ctx-show-parents");
  if (node.data.fatherId || node.data.motherId) {
    showParentsBtn.style.display = "block";
  } else {
    showParentsBtn.style.display = "none";
  }

  // Show/hide and set action for add spouse button
  const addSpouseBtn = document.getElementById("ctx-add-spouse");
  if (addSpouseBtn) {
    if (!node.data.spouseId) {
      addSpouseBtn.style.display = "block";
      addSpouseBtn.onclick = () => {
        hideContextMenu();
        openModal("add-spouse", node.data);
      };
    } else {
      addSpouseBtn.style.display = "none";
      addSpouseBtn.onclick = null;
    }
  }

  // Update button actions
  document.getElementById("ctx-add-child").onclick = () => {
    hideContextMenu();
    openModal("add-child", node.data);
  };

  document.getElementById("ctx-add-parent").onclick = () => {
    hideContextMenu();
    if (node.data.fatherId && node.data.motherId) {
      alert(`${node.data.name} لديه والدين بالفعل`);
    } else {
      openModal("add-parent", node.data);
    }
  };

  document.getElementById("ctx-show-parents").onclick = () => {
    hideContextMenu();
    showPersonWithParents(node.data.id);
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

  // Hide head-of-family fields by default
  document.querySelector(".checkbox-wrapper").style.display = "none";

  // Reset name suggestions dropdown
  const nameInput = document.getElementById("input-name");
  const nameSuggestions = document.getElementById("name-suggestions");
  nameSuggestions.innerHTML = "";
  nameSuggestions.classList.remove("show");

  // Attach input event listener for suggestions (ensures it's always attached)
  nameInput.oninput = showNameSuggestions;
  nameInput.onblur = () =>
    setTimeout(() => nameSuggestions.classList.remove("show"), 150);

  if (action === "add-root") {
    modalTitle.textContent = "إضافة شخص جديد";
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value = "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-info").value = "";
    personForm.dataset.fatherId = "";
    personForm.dataset.motherId = "";
    personForm.dataset.personId = generateId();
  } else if (action === "add-child") {
    modalTitle.textContent = `إضافة طفل لـ ${person.name}`;
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value = "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-info").value = "";
    personForm.dataset.fatherId = person.id;
    personForm.dataset.motherId = person.spouseId || "";
    personForm.dataset.personId = generateId();
  } else if (action === "add-parent") {
    modalTitle.textContent = `إضافة والد لـ ${person.name}`;
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value = "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-info").value = "";
    personForm.dataset.childId = person.id;
    personForm.dataset.personId = generateId();
  } else if (action === "edit") {
    modalTitle.textContent = ` تعديل ${person.name}`;
    document.getElementById("input-name").value = person.name;
    document.getElementById("input-gender").value = person.gender || "male";
    document.getElementById("input-dates").value = person.dates || "";
    document.getElementById("input-info").value = person.info || "";
    personForm.dataset.personId = person.id;
    personForm.dataset.fatherId = person.fatherId || "";
    personForm.dataset.motherId = person.motherId || "";
    personForm.dataset.spouseId = person.spouseId || "";
  } else if (action === "add-spouse") {
    modalTitle.textContent = `إضافة زوج/زوجة لـ ${person.name}`;
    personForm.reset();
    document.getElementById("input-name").value = "";
    document.getElementById("input-gender").value =
      person.gender === "male" ? "female" : "male";
    document.getElementById("input-dates").value = "";
    document.getElementById("input-info").value = "";
    personForm.dataset.spouseFor = person.id;
    personForm.dataset.personId = generateId();
    document.querySelector(".checkbox-wrapper").style.display = "none";
  }
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  personForm.reset();
  // Hide name suggestions dropdown
  const nameSuggestions = document.getElementById("name-suggestions");
  if (nameSuggestions) {
    nameSuggestions.innerHTML = "";
    nameSuggestions.classList.remove("show");
  }
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

  let id = personForm.dataset.personId;
  let name = document.getElementById("input-name").value;
  let gender = document.getElementById("input-gender").value;
  let dates = document.getElementById("input-dates").value;
  const fatherId = personForm.dataset.fatherId;
  const motherId = personForm.dataset.motherId;
  let info = document.getElementById("input-info").value;

  // If a person was selected from suggestions, use their ID and info
  const selectedId = document.getElementById("input-name").dataset.selectedId;
  if (selectedId && allPersons[selectedId]) {
    id = selectedId;
    const selectedPerson = allPersons[selectedId];
    name = selectedPerson.name;
    gender = selectedPerson.gender;
    dates = selectedPerson.dates || "";
    info = selectedPerson.info || "";
    // Clear dataset after use
    document.getElementById("input-name").dataset.selectedId = "";
  }

  function buildPersonData() {
    const personData = { id, name, gender, dates };
    if (fatherId) personData.fatherId = fatherId;
    if (motherId) personData.motherId = motherId;
    if (info) personData.info = info;
    return personData;
  }

  function handleAddChild() {
    const personData = buildPersonData();
    if (fatherId && allPersons[fatherId]) {
      personData.familyId = allPersons[fatherId].familyId;
    } else if (motherId && allPersons[motherId]) {
      personData.familyId = allPersons[motherId].familyId;
    }
    personData.childrenIds = [];
    allPersons[id] = personData;
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
  }

  function handleAddRoot() {
    const personData = buildPersonData();
    personData.familyId = id;
    personData.childrenIds = [];
    allPersons[id] = personData;
    if (currentView === "home") {
      currentView = "home";
    } else {
      currentView = "tree";
      currentRootId = id;
      expandedNodes.clear();
      expandedNodes.add(id);
    }
  }

  function handleAddParent() {
    const personData = buildPersonData();
    const childId = personForm.dataset.childId;
    const child = allPersons[childId];
    // If this parent already exists, preserve their childrenIds, else start with []
    let childrenIds =
      allPersons[id] && Array.isArray(allPersons[id].childrenIds)
        ? [...allPersons[id].childrenIds]
        : [];
    // Add the new child if not already present
    if (!childrenIds.includes(childId)) {
      childrenIds.push(childId);
    }
    personData.childrenIds = childrenIds;
    if (child) {
      if (gender === "male") {
        child.fatherId = id;
      } else {
        child.motherId = id;
      }
      currentView = "tree";
      currentRootId = id;
      expandedNodes.clear();
      expandedNodes.add(id);
    }
    allPersons[id] = personData;
  }

  function handleEdit() {
    const personData = buildPersonData();
    personData.childrenIds = allPersons[id].childrenIds || [];
    allPersons[id] = personData;
  }

  function handleAddSpouse() {
    const spouseForId = personForm.dataset.spouseFor;
    const spouseName = document.getElementById("input-name").value;
    const spouseGender = document.getElementById("input-gender").value;
    const spouseDates = document.getElementById("input-dates").value;
    const spouseInfo = document.getElementById("input-info").value;
    const spouseId = id;
    const spouse = {
      id: spouseId,
      name: spouseName,
      gender: spouseGender,
      dates: spouseDates,
      info: spouseInfo,
      spouseId: spouseForId,
      familyId: spouseId,
      childrenIds: allPersons[spouseForId]?.childrenIds
        ? [...allPersons[spouseForId].childrenIds]
        : [],
    };
    allPersons[spouseId] = spouse;
    allPersons[spouseForId].spouseId = spouseId;
  }

  switch (currentAction) {
    case "add-child":
      handleAddChild();
      break;
    case "add-root":
      handleAddRoot();
      break;
    case "add-parent":
      handleAddParent();
      break;
    case "edit":
      handleEdit();
      break;
    case "add-spouse":
      handleAddSpouse();
      break;
    default:
      break;
  }

  saveData();
  closeModal();
  render();
}

function deletePerson(personId) {
  const person = allPersons[personId];
  if (!person) return;

  removeFromParents(person);
  removeFromSpouse(person);
  removeFromChildren(person);
  delete allPersons[personId];

  if (currentRootId === personId) {
    // If the deleted person was the current root, navigate to home
    goHome();
  }

  saveData();
  render();
}

function removeFromParents(person) {
  const personId = person.id;
  if (person.fatherId) {
    const father = allPersons[person.fatherId];
    if (father && Array.isArray(father.childrenIds)) {
      father.childrenIds = father.childrenIds.filter((id) => id !== personId);
    }
  }
  if (person.motherId) {
    const mother = allPersons[person.motherId];
    if (mother && Array.isArray(mother.childrenIds)) {
      mother.childrenIds = mother.childrenIds.filter((id) => id !== personId);
    }
  }
}

function removeFromSpouse(person) {
  const personId = person.id;
  if (person.spouseId) {
    const spouse = allPersons[person.spouseId];
    if (spouse) {
      if (spouse.spouseId === personId) {
        delete spouse.spouseId;
      }
    }
  }
}

function removeFromChildren(person) {
  const personId = person.id;
  if (person.childrenIds && person.childrenIds.length > 0) {
    person.childrenIds
      .map((childId) => allPersons[childId])
      .filter(
        (child) => child.fatherId === personId || child.motherId === personId,
      )
      .forEach((child) => {
        if (child.fatherId === personId) {
          delete child.fatherId;
        }
        if (child.motherId === personId) {
          delete child.motherId;
        }
      });
  }
}

// Make a person the root of their own family
function makePersonFamilyRoot(personId) {
  const person = allPersons[personId];
  if (!person) return;

  // Set this person as their own family patriarch
  person.familyId = personId;

  updateDescendants(person);

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
    newFamilyId = allPersons[person.fatherId].familyId;
  } else if (person.motherId && allPersons[person.motherId]) {
    newFamilyId = allPersons[person.motherId].familyId;
  }

  person.familyId = newFamilyId;

  updateDescendants(person);

  saveData();
  render();

  if (newFamilyId) {
    const patriarch = allPersons[newFamilyId];
    alert(`تم إرجاع ${person.name} وأفراده إلى عائلة ${patriarch.name}.`);
  } else {
    alert(`${person.name} وأفراده لم يعودوا لهم انتماء عائلي.`);
  }
}

function updateDescendants(person) {
  if (!person || !person.childrenIds) return;
  // Collect all male descendants iteratively
  const stack = [...person.childrenIds];
  const maleDescendants = [];
  while (stack.length) {
    const id = stack.pop();
    const child = allPersons[id];
    if (child?.gender === "male") {
      maleDescendants.push(child);
      stack.push(...child.childrenIds);
    }
  }
  maleDescendants.forEach((descendant) => {
    descendant.familyId = person.familyId;
  });
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

// =============================================
// NAME SUGGESTIONS (GLOBAL)
// =============================================
function showNameSuggestions() {
  const nameInput = document.getElementById("input-name");
  const genderInput = document.getElementById("input-gender");
  const datesInput = document.getElementById("input-dates");

  const nameSuggestions = document.getElementById("name-suggestions");
  const query = nameInput.value.toLowerCase().trim();
  if (!query) {
    nameSuggestions.innerHTML = "";
    nameSuggestions.classList.remove("show");
    return;
  }
  // Suggest persons not the current one (for edit), and not already linked as spouse/parent/child
  const excludeId = personForm.dataset.personId;
  const results = Object.values(allPersons)
    .filter((p) => p.name.toLowerCase().includes(query) && p.id !== excludeId)
    .slice(0, 6);
  if (results.length === 0) {
    nameSuggestions.innerHTML = "";
    nameSuggestions.classList.remove("show");
    return;
  }
  nameSuggestions.innerHTML = results
    .map((person) => {
      const patriarch = allPersons[person.familyId];
      const familyName = patriarch
        ? `عائلة ${patriarch.name}`
        : `عائلة ${person.name}`;
      return `
        <div class="name-suggestion-item" data-id="${person.id}">
          <div class="name-suggestion-name">${person.name}</div>
          <div class="name-suggestion-info">${familyName} ${person.dates ? "• " + person.dates : ""}</div>
        </div>
      `;
    })
    .join("");
  nameSuggestions.classList.add("show");
  // Click handler
  nameSuggestions.querySelectorAll(".name-suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      const personId = item.dataset.id;
      const person = allPersons[personId];
      if (person) {
        nameInput.value = person.name;
        nameInput.dataset.selectedId = personId;
        // Fill other fields if present
        const genderInput = document.getElementById("input-gender");
        const datesInput = document.getElementById("input-dates");
        const infoInput = document.getElementById("input-info");
        if (genderInput) genderInput.value = person.gender || "male";
        if (datesInput) datesInput.value = person.dates || "";
        if (infoInput) infoInput.value = person.info || "";
      }
      nameSuggestions.classList.remove("show");
    });
  });
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
