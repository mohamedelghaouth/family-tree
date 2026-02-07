// =============================================
// TREE RENDERING
// D3.js tree visualization logic
// =============================================

const Tree = {
  svg: null,
  g: null,
  zoom: null,
  width: 0,
  height: 0,
  links: null, // Store links for dynamic updates
  linkData: null, // Store link data

  // Initialize D3 tree
  init() {
    this.svg = d3.select("#tree-svg");
    this.updateDimensions();
    this.g = this.svg.append("g");

    this.zoom = d3
      .zoom()
      .scaleExtent([0.3, 2])
      .filter((event) => {
        // For touch events, always allow (touchstart, touchmove, touchend)
        if (event.type.startsWith("touch")) return true;
        // Block right-click and middle button for mousedown
        if (event.type === "mousedown" && event.button !== 0) return false;
        // Block ctrl+wheel (browser zoom)
        if (event.type === "wheel" && event.ctrlKey) return false;
        // Allow other mouse events
        return true;
      })
      .on("zoom", (event) => this.g.attr("transform", event.transform));

    this.svg.call(this.zoom).on("dblclick.zoom", null); // Disable double-click zoom

    this.centerView();
  },

  // Update dimensions from current window size
  updateDimensions() {
    this.width = window.innerWidth;
    this.height = window.innerHeight - 56; // Account for header height
    this.svg.attr("width", this.width).attr("height", this.height);
  },

  // Center the view
  centerView() {
    // Update dimensions first to get current window size
    this.updateDimensions();
    this.svg.call(
      this.zoom.transform,
      d3.zoomIdentity.translate(this.width / 2, 100).scale(1),
    );
  },

  // Build tree data structure from a person (with expansion state and target path)
  buildTreeData(
    personId,
    allPersons,
    expandedNodes,
    targetPersonId = null,
    pathToTarget = [],
    level = 0,
  ) {
    const person = allPersons[personId];
    if (!person) return null;

    const node = { ...person };

    // Only expand children if this node is expanded or it's the root
    if (person.childrenIds && person.childrenIds.length > 0) {
      if (level === 0 || expandedNodes.has(personId)) {
        // If we have a target path and this node is in the path
        if (
          targetPersonId &&
          pathToTarget.length > 0 &&
          pathToTarget.includes(personId)
        ) {
          // Show ALL children (siblings), but only expand the one in the path
          node.children = person.childrenIds
            .map((id) => {
              const childInPath = pathToTarget.includes(id);
              if (childInPath) {
                // This child is in the path to target - expand it
                return this.buildTreeData(
                  id,
                  allPersons,
                  expandedNodes,
                  targetPersonId,
                  pathToTarget,
                  level + 1,
                );
              } else {
                // This child is a sibling (not in path) - show it but don't expand
                const sibling = allPersons[id];
                return sibling ? { ...sibling } : null;
              }
            })
            .filter(Boolean);
        } else {
          // Normal expansion (no target filtering)
          node.children = person.childrenIds
            .map((id) =>
              this.buildTreeData(
                id,
                allPersons,
                expandedNodes,
                targetPersonId,
                pathToTarget,
                level + 1,
              ),
            )
            .filter(Boolean);
        }
      }
    }

    return node;
  },

  // Render the tree
  render(
    currentRootId,
    allPersons,
    selectedNodeId,
    expandedNodes,
    targetPersonId,
    nodeOffsets,
    onUpdateOffset,
    onNodeClick,
    onNodeRightClick,
    onSpouseClick,
    onToggleExpand,
  ) {
    this.g.selectAll("*").remove();

    // Add a large background rectangle for panning (very subtle color, captures all events)
    this.g
      .append("rect")
      .attr("class", "tree-background")
      .attr("width", this.width * 10)
      .attr("height", this.height * 10)
      .attr("x", -this.width * 5)
      .attr("y", -this.height * 5)
      .attr("fill", "rgba(0, 0, 0, 0.01)") // Very subtle, almost invisible
      .attr("pointer-events", "all")
      .style("cursor", "grab");

    // Get path to target if specified
    let pathToTarget = [];
    if (targetPersonId) {
      pathToTarget = this.getPathToTarget(
        currentRootId,
        targetPersonId,
        allPersons,
      );
    }

    const treeData = this.buildTreeData(
      currentRootId,
      allPersons,
      expandedNodes,
      targetPersonId,
      pathToTarget,
    );
    if (!treeData) return;

    const root = d3.hierarchy(treeData);

    const treeLayout = d3
      .tree()
      .nodeSize([180, 140])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    treeLayout(root);

    // Apply stored offsets to positions (including inherited offsets from ancestors)
    root.descendants().forEach((d) => {
      // Accumulate offsets from all ancestors
      let totalDx = 0;
      let totalDy = 0;

      // Traverse up the tree to accumulate ancestor offsets
      let current = d;
      while (current) {
        const offset = nodeOffsets[current.data.id];
        if (offset) {
          totalDx += offset.dx;
          totalDy += offset.dy;
        }
        current = current.parent;
      }

      // Apply accumulated offset
      d.x += totalDx;
      d.y += totalDy;
    });

    // Draw links
    this.linkData = root.links();
    this.links = this.g
      .selectAll(".tree-link")
      .data(this.linkData)
      .enter()
      .append("path")
      .attr("class", "tree-link")
      .attr(
        "d",
        d3
          .linkVertical()
          .x((d) => d.x)
          .y((d) => d.y),
      );

    // Function to update links
    const updateLinks = () => {
      this.links.attr(
        "d",
        d3
          .linkVertical()
          .x((d) => d.x)
          .y((d) => d.y),
      );
    };

    // Draw nodes
    const nodes = this.g
      .selectAll(".node-group")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node-group")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "grab")
      .call(
        d3
          .drag()
          .filter((event) => {
            // Allow dragging on touch and mouse primary button
            return event.type === "mousedown" ? event.button === 0 : true;
          })
          .touchable(true)
          .on("start", function (event, d) {
            // Don't stop propagation immediately - let it happen after drag starts moving
            d3.select(this).style("cursor", "grabbing");
            // Store initial position
            d._dragStartX = d.x;
            d._dragStartY = d.y;
            d._hasDragged = false;
          })
          .on("drag", function (event, d) {
            // Only stop propagation once we've actually moved (prevents blocking pan on tap)
            if (!d._hasDragged) {
              const dist = Math.sqrt(
                Math.pow(event.x - d._dragStartX, 2) +
                  Math.pow(event.y - d._dragStartY, 2),
              );
              if (dist > 5) {
                // 5px threshold to distinguish drag from tap
                event.sourceEvent.stopPropagation();
                d._hasDragged = true;
              } else {
                return; // Don't drag yet if below threshold
              }
            }

            // Calculate offset from start position
            const dx = event.x - d._dragStartX;
            const dy = event.y - d._dragStartY;

            // Update this node's position
            d.x = event.x;
            d.y = event.y;
            d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);

            // Update offset ONLY for this node (descendants inherit it)
            onUpdateOffset(d.data.id, dx, dy);

            // Update all descendants visually (they will inherit offset on next render)
            if (d.descendants) {
              d.descendants().forEach((descendant, i) => {
                if (i > 0) {
                  // Skip self (index 0)
                  descendant.x += dx;
                  descendant.y += dy;
                  // Update visual position
                  nodes
                    .filter((n) => n.data.id === descendant.data.id)
                    .attr(
                      "transform",
                      `translate(${descendant.x}, ${descendant.y})`,
                    );
                }
              });
            }

            // Reset drag start for next iteration
            d._dragStartX = event.x;
            d._dragStartY = event.y;

            updateLinks(); // Update links during drag
          })
          .on("end", function (event, d) {
            // Only stop propagation if we actually dragged (not just a tap)
            if (d._hasDragged) {
              event.sourceEvent.stopPropagation();
            }
            d3.select(this).style("cursor", "grab");
          }),
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .on("contextmenu", (event, d) => {
        event.preventDefault();
        onNodeRightClick(event, d);
      });

    const cardWidth = 150;
    const cardHeight = 80;

    // Card background
    nodes
      .append("rect")
      .attr("class", "node-card")
      .attr("x", -cardWidth / 2)
      .attr("y", -cardHeight / 2)
      .attr("width", cardWidth)
      .attr("height", cardHeight);

    // Name
    nodes
      .append("text")
      .attr("class", "node-name")
      .attr("y", -22)
      .text((d) => this.truncate(d.data.name, 18));

    // Gender symbol
    nodes
      .append("text")
      .attr("class", "node-gender-symbol")
      .attr("y", -22)
      .attr("x", 52)
      .attr("font-size", "14px")
      .text((d) => (d.data.gender === "female" ? "♀️" : "♂️"));

    // Dates
    nodes
      .append("text")
      .attr("class", "node-dates")
      .attr("y", -8)
      .text((d) => d.data.dates || "");

    // Spouse section
    nodes
      .filter((d) => d.data.spouseId)
      .each(function (d) {
        const spouse = allPersons[d.data.spouseId];
        if (!spouse) return;

        const g = d3.select(this);

        // Divider line
        g.append("line")
          .attr("x1", -cardWidth / 2)
          .attr("y1", 8)
          .attr("x2", cardWidth / 2)
          .attr("y2", 8)
          .attr("stroke", "#475569")
          .attr("stroke-width", 1);

        // Spouse icon
        g.append("text")
          .attr("class", "node-spouse-label")
          .attr("y", 20)
          .text("💑");

        // Spouse name (clickable)
        g.append("text")
          .attr("class", "node-spouse")
          .attr("y", 32)
          .text(Tree.truncate(spouse.name, 18))
          .style("cursor", "pointer")
          .on("click", (event) => {
            event.stopPropagation();
            onSpouseClick(d.data.spouseId);
          });
      });

    // Children expand/collapse badge
    nodes
      .filter((d) => d.data.childrenIds && d.data.childrenIds.length > 0)
      .each(function (d) {
        const g = d3.select(this);
        const isExpanded = d.children && d.children.length > 0;

        // Always show badge when there are children
        const badgeGroup = g
          .append("g")
          .attr("class", "expand-badge")
          .style("cursor", "pointer")
          .on("click", (event) => {
            event.stopPropagation();
            onToggleExpand(d.data.id);
          });

        // Background circle
        badgeGroup
          .append("circle")
          .attr("cx", 0)
          .attr("cy", cardHeight / 2 + 10)
          .attr("r", 12)
          .attr("fill", isExpanded ? "#ef4444" : "var(--accent)")
          .attr("opacity", 0.2);

        // Badge text: "-" when expanded, "+N" when collapsed
        badgeGroup
          .append("text")
          .attr("class", "node-children-badge")
          .attr("y", cardHeight / 2 + 14)
          .style("fill", isExpanded ? "#ef4444" : "var(--accent)")
          .text(isExpanded ? "−" : `+${d.data.childrenIds.length}`);
      });

    // Highlight selected node
    if (selectedNodeId) {
      nodes
        .filter((d) => d.data.id === selectedNodeId)
        .classed("selected", true);
    }
  },

  // Highlight and scroll to a person
  highlightPerson(personId) {
    this.g
      .selectAll(".node-group")
      .classed("highlight", false)
      .filter((d) => d.data.id === personId)
      .classed("highlight", true);

    // Center on the node
    const node = this.g
      .selectAll(".node-group")
      .filter((d) => d.data.id === personId)
      .node();

    if (node) {
      const bbox = node.getBBox();
      const transform = d3.zoomIdentity
        .translate(
          this.width / 2 - bbox.x - bbox.width / 2,
          this.height / 2 - bbox.y - bbox.height / 2,
        )
        .scale(1);

      this.svg.transition().duration(500).call(this.zoom.transform, transform);
    }

    // Remove highlight after delay
    setTimeout(() => {
      this.g.selectAll(".node-group").classed("highlight", false);
    }, 2500);
  },

  // Scroll to show a person and their children
  scrollToShowChildren(personId) {
    const nodes = this.g.selectAll(".node-group").filter((d) => {
      // Find the parent node and its immediate children
      return d.data.id === personId || d.parent?.data.id === personId;
    });

    if (nodes.empty()) return;

    // Calculate bounding box of parent and children
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    nodes.each(function (d) {
      const bbox = this.getBBox();
      minX = Math.min(minX, d.x + bbox.x);
      maxX = Math.max(maxX, d.x + bbox.x + bbox.width);
      minY = Math.min(minY, d.y + bbox.y);
      maxY = Math.max(maxY, d.y + bbox.y + bbox.height);
    });

    // Calculate center and scale to fit
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;

    // Calculate scale to fit with padding
    const scale = Math.min(
      this.width / (width + 200),
      this.height / (height + 200),
      1.2, // Max zoom
    );

    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    this.svg
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .call(this.zoom.transform, transform);
  },

  // Truncate text
  truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.substring(0, len - 1) + "…" : str;
  },

  // Get path from root to target person
  getPathToTarget(rootId, targetId, allPersons) {
    const path = [];
    const visited = new Set();

    const findPath = (currentId) => {
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
    };

    findPath(rootId);
    return path.reverse();
  },
};
