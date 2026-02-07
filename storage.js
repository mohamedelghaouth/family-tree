// =============================================
// LOCAL STORAGE MANAGER
// Handles saving and loading family data
// =============================================

const STORAGE_KEY = "familyTreeData";

const Storage = {
  // Load all persons from local storage
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading from storage:", error);
    }
    return null;
  },

  // Save all persons to local storage
  save(allPersons) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPersons));
      console.log("✅ Family tree saved to local storage");
      return true;
    } catch (error) {
      console.error("Error saving to storage:", error);
      alert("Failed to save family tree data");
      return false;
    }
  },

  // Clear all data
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Family tree data cleared");
      return true;
    } catch (error) {
      console.error("Error clearing storage:", error);
      return false;
    }
  },

  // Export data as JSON file
  exportToFile(allPersons) {
    const dataStr = JSON.stringify(allPersons, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `family-tree-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // Import data from JSON file
  importFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        callback(data);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  },
};
