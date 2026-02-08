const fs = require("fs");

/**
 * Complete script to merge two family tree JSON objects and fix all parent-child relationships
 *
 * Usage:
 * 1. Replace family1 and family2Raw with your JSON data
 * 2. Run: node merge_and_fix_family_trees.js
 * 3. Output will be saved to merged_family_tree.json and merged_family_tree.js
 */

// ========== STEP 1: INPUT YOUR FAMILY TREE DATA HERE ==========

// First family tree (original)
const family1 = {
  // Paste your first JSON object here
  // Example structure:
  // "p1": { "id": "p1", "name": "...", ... }
};

// Second family tree (will be renumbered to avoid ID conflicts)
const family2Raw = {
  // Paste your second JSON object here
  // Example structure:
  // "p1": { "id": "p1", "name": "...", ... }
};

// ========== STEP 2: MERGE AND RENUMBER ==========

console.log("=== STEP 1: MERGING FAMILY TREES ===\n");

// Create ID mapping for family 2 (offset to avoid conflicts)
const idMap = {};
let nextId =
  Math.max(...Object.keys(family1).map((k) => parseInt(k.replace("p", "")))) +
  1;

console.log(`Renumbering family2 starting from p${nextId}`);

Object.keys(family2Raw).forEach((oldId) => {
  const newId = `p${nextId}`;
  idMap[oldId] = newId;
  nextId++;
});

// Renumber family 2 with updated references
const family2 = {};
Object.entries(family2Raw).forEach(([oldId, person]) => {
  const newId = idMap[oldId];
  const newPerson = {
    ...person,
    id: newId,
  };

  // Update all ID references
  if (person.fatherId && idMap[person.fatherId]) {
    newPerson.fatherId = idMap[person.fatherId];
  }
  if (person.motherId && idMap[person.motherId]) {
    newPerson.motherId = idMap[person.motherId];
  }
  if (person.spouseId && idMap[person.spouseId]) {
    newPerson.spouseId = idMap[person.spouseId];
  }
  if (person.spouseIds) {
    newPerson.spouseIds = person.spouseIds.map((id) => idMap[id] || id);
  }
  if (person.childrenIds) {
    newPerson.childrenIds = person.childrenIds.map((id) => idMap[id] || id);
  }
  if (person.familyId && idMap[person.familyId]) {
    newPerson.familyId = idMap[person.familyId];
  }

  family2[newId] = newPerson;
});

// Merge the two families
const merged = {
  ...family1,
  ...family2,
};

console.log(
  `✅ Merged ${Object.keys(family1).length} + ${Object.keys(family2).length} = ${Object.keys(merged).length} persons\n`,
);

// ========== STEP 3: FIX PARENT-CHILD RELATIONSHIPS ==========

console.log("=== STEP 2: FIXING PARENT-CHILD RELATIONSHIPS ===\n");

// Step 3a: Add missing motherIds
Object.values(merged).forEach((person) => {
  if (
    person.childrenIds &&
    person.childrenIds.length > 0 &&
    person.gender === "female"
  ) {
    person.childrenIds.forEach((childId) => {
      const child = merged[childId];
      if (child && !child.motherId) {
        console.log(
          `Adding motherId ${person.id} to ${child.name} (${childId})`,
        );
        child.motherId = person.id;
      }
    });
  }
});

// Step 3b: Add missing fatherIds
Object.values(merged).forEach((person) => {
  if (
    person.childrenIds &&
    person.childrenIds.length > 0 &&
    person.gender === "male"
  ) {
    person.childrenIds.forEach((childId) => {
      const child = merged[childId];
      if (child && !child.fatherId) {
        console.log(
          `Adding fatherId ${person.id} to ${child.name} (${childId})`,
        );
        child.fatherId = person.id;
      }
    });
  }
});

// Step 3c: Fix incorrect father/mother references in children
Object.values(merged).forEach((person) => {
  if (person.childrenIds && person.childrenIds.length > 0) {
    person.childrenIds.forEach((childId) => {
      const child = merged[childId];
      if (!child) return;

      if (person.gender === "male") {
        if (child.fatherId && child.fatherId !== person.id) {
          console.log(
            `Correcting fatherId for ${child.name} (${childId}): ${child.fatherId} -> ${person.id}`,
          );
          child.fatherId = person.id;
        }
      } else if (person.gender === "female") {
        if (child.motherId && child.motherId !== person.id) {
          console.log(
            `Correcting motherId for ${child.name} (${childId}): ${child.motherId} -> ${person.id}`,
          );
          child.motherId = person.id;
        }
      }
    });
  }
});

// Step 3d: Add missing children to parent's childrenIds based on fatherId/motherId
Object.values(merged).forEach((person) => {
  if (person.fatherId) {
    const father = merged[person.fatherId];
    if (father) {
      if (!father.childrenIds) father.childrenIds = [];
      if (!father.childrenIds.includes(person.id)) {
        console.log(
          `Adding ${person.name} (${person.id}) to father's children: ${father.name} (${father.id})`,
        );
        father.childrenIds.push(person.id);
      }
    }
  }

  if (person.motherId) {
    const mother = merged[person.motherId];
    if (mother) {
      if (!mother.childrenIds) mother.childrenIds = [];
      if (!mother.childrenIds.includes(person.id)) {
        console.log(
          `Adding ${person.name} (${person.id}) to mother's children: ${mother.name} (${mother.id})`,
        );
        mother.childrenIds.push(person.id);
      }
    }
  }
});

// Step 3e: Fix conflicting parent references
// If a child appears in multiple parents' childrenIds, use the child's fatherId/motherId as truth
const childToFathers = new Map();
const childToMothers = new Map();

Object.values(merged).forEach((person) => {
  if (person.childrenIds && person.childrenIds.length > 0) {
    person.childrenIds.forEach((childId) => {
      if (person.gender === "male") {
        if (!childToFathers.has(childId)) childToFathers.set(childId, []);
        childToFathers.get(childId).push(person.id);
      } else if (person.gender === "female") {
        if (!childToMothers.has(childId)) childToMothers.set(childId, []);
        childToMothers.get(childId).push(person.id);
      }
    });
  }
});

// Remove child from parents where the child's fatherId/motherId doesn't match
childToFathers.forEach((fatherIds, childId) => {
  const child = merged[childId];
  if (!child) return;

  if (fatherIds.length > 1) {
    console.log(
      `\nConflict: ${child.name} (${childId}) has multiple fathers in childrenIds: ${fatherIds.join(", ")}`,
    );
    console.log(`Child's fatherId is: ${child.fatherId}`);

    fatherIds.forEach((fatherId) => {
      if (fatherId !== child.fatherId) {
        const wrongFather = merged[fatherId];
        console.log(
          `Removing ${childId} from ${wrongFather.name}'s (${fatherId}) children`,
        );
        wrongFather.childrenIds = wrongFather.childrenIds.filter(
          (id) => id !== childId,
        );
      }
    });
  }
});

childToMothers.forEach((motherIds, childId) => {
  const child = merged[childId];
  if (!child) return;

  if (motherIds.length > 1) {
    console.log(
      `\nConflict: ${child.name} (${childId}) has multiple mothers in childrenIds: ${motherIds.join(", ")}`,
    );
    console.log(`Child's motherId is: ${child.motherId}`);

    motherIds.forEach((motherId) => {
      if (motherId !== child.motherId) {
        const wrongMother = merged[motherId];
        console.log(
          `Removing ${childId} from ${wrongMother.name}'s (${motherId}) children`,
        );
        wrongMother.childrenIds = wrongMother.childrenIds.filter(
          (id) => id !== childId,
        );
      }
    });
  }
});

// Step 3f: Sort all childrenIds arrays
Object.values(merged).forEach((person) => {
  if (person.childrenIds && person.childrenIds.length > 0) {
    person.childrenIds.sort((a, b) => {
      const numA = parseInt(a.replace("p", ""));
      const numB = parseInt(b.replace("p", ""));
      return numA - numB;
    });
  }
});

// ========== STEP 4: VERIFICATION ==========

console.log("\n=== STEP 3: FINAL VERIFICATION ===\n");
let errors = 0;

Object.values(merged).forEach((person) => {
  if (person.childrenIds && person.childrenIds.length > 0) {
    person.childrenIds.forEach((childId) => {
      const child = merged[childId];
      if (!child) {
        console.log(
          `❌ Missing child ${childId} referenced by ${person.name} (${person.id})`,
        );
        errors++;
        return;
      }

      if (person.gender === "male" && child.fatherId !== person.id) {
        console.log(
          `❌ ${person.name} (${person.id}) has child ${child.name} (${childId}) but fatherId is ${child.fatherId}`,
        );
        errors++;
      } else if (person.gender === "female" && child.motherId !== person.id) {
        console.log(
          `❌ ${person.name} (${person.id}) has child ${child.name} (${childId}) but motherId is ${child.motherId}`,
        );
        errors++;
      }
    });
  }

  if (person.fatherId) {
    const father = merged[person.fatherId];
    if (father && !father.childrenIds.includes(person.id)) {
      console.log(
        `❌ ${person.name} (${person.id}) has father ${father.name} (${person.fatherId}) but not in father's children`,
      );
      errors++;
    }
  }

  if (person.motherId) {
    const mother = merged[person.motherId];
    if (mother && !mother.childrenIds.includes(person.id)) {
      console.log(
        `❌ ${person.name} (${person.id}) has mother ${mother.name} (${person.motherId}) but not in mother's children`,
      );
      errors++;
    }
  }
});

if (errors === 0) {
  console.log("✅ All parent-child relationships are consistent!");
} else {
  console.log(`⚠️  Found ${errors} errors - manual review needed`);
}

// ========== STEP 5: OUTPUT ==========

console.log("\n=== STEP 4: SAVING OUTPUT ===\n");

// Save as JSON
fs.writeFileSync("merged_family_tree.json", JSON.stringify(merged, null, 2));
console.log(
  `✅ Saved as merged_family_tree.json (${Object.keys(merged).length} persons)`,
);

// Save as JavaScript module
const jsOutput = `const familyTree = ${JSON.stringify(merged, null, 2)};

export default familyTree;`;

fs.writeFileSync("merged_family_tree.js", jsOutput);
console.log(`✅ Saved as merged_family_tree.js`);

console.log("\n🎉 Done!");
