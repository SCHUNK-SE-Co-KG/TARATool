/**
 * @file        attack_tree_editor_v2.js
 * @description Attack tree editor V2 – recursive card-based editor with variable depth
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */
(function () {
  "use strict";

  // ---------- helpers ----------
  const _uid = (prefix) => {
    try { if (typeof generateUID === "function") return generateUID(prefix); } catch (_) {}
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  };

  const _qs = (sel, root = document) => root.querySelector(sel);
  const _qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Delegates to global escapeHtml() in utils.js (single source of truth). */
  const _escapeHtml = (str) => escapeHtml(str);

  function _confirm({ title, html, confirmText = "Löschen", confirmClass = "primary-button dangerous", onConfirm }) {
    const modal = document.getElementById("confirmationModal");
    const t = document.getElementById("confirmationTitle");
    const msg = document.getElementById("confirmationMessage");
    const btnConfirm = document.getElementById("btnConfirmAction");
    const btnCancel = document.getElementById("btnCancelConfirmation");
    const btnClose = document.getElementById("closeConfirmationModal");
    if (!modal || !t || !msg || !btnConfirm || !btnCancel || !btnClose) {
      if (confirm(`${title}\n\n${String(html || "").replace(/<[^>]*>/g, "")}`)) onConfirm?.();
      return;
    }

    t.textContent = title || "Bestätigung";
    msg.innerHTML = html || "Sicher?";
    btnConfirm.textContent = confirmText;
    btnConfirm.className = confirmClass;

    modal.style.display = "block";
    btnConfirm.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;

    const close = () => (modal.style.display = "none");
    btnCancel.onclick = close;
    btnClose.onclick = close;
    btnConfirm.onclick = () => { close(); onConfirm?.(); };
  }

  // ---------- model ----------
  function newNode(title = "", depth = 1) {
    return {
      uid: _uid("node"),
      title,
      depth,
      collapsed: false,
      kstu: { k: "", s: "", t: "", u: "" },
      i_norm: "",
      impacts: [],
      children: [],
    };
  }

  function newImpact(text = "") {
    return {
      uid: _uid("leaf"),
      text,
      ds: [],
      k: "",
      s: "",
      t: "",
      u: "",
      i_norm: "",
    };
  }

  // ---------- legacy -> v2 conversion ----------
  function _getLegacyDepth(entry) {
    try { if (typeof _getTreeDepthForData === "function") return _getTreeDepthForData(entry); } catch (_) {}
    const d = parseInt(entry?.treeDepth, 10);
    if (d === 4) return 4;
    if (d === 3) return (entry?.useThirdIntermediate === true) ? 3 : 2;
    if (d === 2) return 2;
    return 1;
  }

  function _leafCloneWithUid(leaf) {
    const l = Object.assign({}, leaf || {});
    if (!l.uid) l.uid = _uid("leaf");
    if (!Array.isArray(l.ds)) l.ds = [];
    if (l.text == null) l.text = l.name || "";
    if (l.k == null) l.k = "";
    if (l.s == null) l.s = "";
    if (l.t == null) l.t = "";
    if (l.u == null) l.u = "";
    if (l.i_norm == null) l.i_norm = "";
    return l;
  }

  function legacyToV2(entry) {
    const root = newNode(entry?.rootName || "", 0);
    root.uid = entry?.treeV2?.uid || root.uid;

    const depth = _getLegacyDepth(entry);
    const branches = Array.isArray(entry?.branches) ? entry.branches : [];

    branches.forEach((b) => {
      if (!b || !b.name) return;
      const path = newNode(b.name, 1);

      if (depth === 1) {
        (Array.isArray(b.leaves) ? b.leaves : []).forEach((lf) => path.impacts.push(_leafCloneWithUid(lf)));
        root.children.push(path);
        return;
      }

      if (depth === 2) {
        let nodes = [];
        if (Array.isArray(b.l2_nodes) && b.l2_nodes.length) nodes = b.l2_nodes;
        else if (b.l2_node) nodes = [{ name: b.l2_node?.name || "", leaves: Array.isArray(b.leaves) ? b.leaves : [] }];
        else nodes = [{ name: "", leaves: Array.isArray(b.leaves) ? b.leaves : [] }];

        nodes.forEach((n) => {
          const nm = (n?.name || "").trim();
          const leaves = Array.isArray(n?.leaves) ? n.leaves : [];
          if (!nm) leaves.forEach((lf) => path.impacts.push(_leafCloneWithUid(lf)));
          else {
            const child = newNode(nm, 2);
            leaves.forEach((lf) => child.impacts.push(_leafCloneWithUid(lf)));
            path.children.push(child);
          }
        });

        root.children.push(path);
        return;
      }

      const isDepth4 = (depth === 4);

      const getLeavesA = () => {
        if (Array.isArray(b.leaves)) return b.leaves;
        if (isDepth4 && Array.isArray(b?.l4_node?.leaves)) return b.l4_node.leaves;
        if (!isDepth4 && Array.isArray(b?.l3_node?.leaves)) return b.l3_node.leaves;
        return [];
      };

      const getLeavesB = () => {
        if (Array.isArray(b.leaves_b)) return b.leaves_b;
        if (isDepth4 && Array.isArray(b?.l4b_node?.leaves)) return b.l4b_node.leaves;
        if (!isDepth4 && Array.isArray(b?.l3b_node?.leaves)) return b.l3b_node.leaves;
        return [];
      };

      const chainAttach = (parentNode, names, leaves) => {
        let cur = parentNode;
        names.forEach((nm) => {
          const name = (nm || "").trim();
          if (!name) return;
          const nn = newNode(name, cur.depth + 1);
          cur.children.push(nn);
          cur = nn;
        });
        (leaves || []).forEach((lf) => cur.impacts.push(_leafCloneWithUid(lf)));
      };

      const aNames = [b?.l2_node?.name || "", b?.l3_node?.name || "", isDepth4 ? (b?.l4_node?.name || "") : ""];
      chainAttach(path, aNames, getLeavesA());

      const bNames = [b?.l2b_node?.name || "", b?.l3b_node?.name || "", isDepth4 ? (b?.l4b_node?.name || "") : ""];
      const leavesB = getLeavesB();
      if (bNames.some(x => (x || "").trim() !== "") || (leavesB && leavesB.length)) {
        chainAttach(path, bNames, leavesB);
      }

      root.children.push(path);
    });

    return root;
  }

  // ---------- render ----------
  function render(editor, rootNode) {
    const host = editor.host;
    host.innerHTML = "";
    rootNode.children.forEach((n) => host.appendChild(renderNode(editor, rootNode, n, 1, [rootNode.title || "Root"])));
  }

  function renderNode(editor, parent, node, depth, crumb) {
    const card = document.createElement("div");
    card.className = "at-card at-node-card";
    card.dataset.uid = node.uid;
    card.dataset.depth = String(depth);

    const header = document.createElement("div");
    header.className = "at-card-header";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "action-button small";
    collapseBtn.title = node.collapsed ? "Aufklappen" : "Einklappen";
    collapseBtn.innerHTML = node.collapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
    collapseBtn.onclick = () => { node.collapsed = !node.collapsed; editor.rerender(); };

    const title = document.createElement("input");
    title.type = "text";
    title.className = "at-node-title";
    title.value = node.title || "";
    title.placeholder = depth === 1 ? "Name Angriffspfad" : "Name Zwischenpfad";
    title.title = depth === 1 ? "Angriffspfad (Kindknoten unter Root)" : "Zwischenpfad (rekursiv)";
    title.oninput = () => { node.title = title.value; editor.updateBreadcrumbs(); editor.updateSummaries(); };

    const breadcrumb = document.createElement("div");
    breadcrumb.className = "at-breadcrumb";
    breadcrumb.title = "Pfad im Baum";
    breadcrumb.textContent = [...crumb, node.title || "(unbenannt)"].join(" → ");

    const summary = document.createElement("div");
    summary.className = "node-stats-box at-node-summary";
    summary.id = `atv2_node_summary_${node.uid}`;
    summary.style.width = "220px";
    summary.style.marginTop = "0";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "action-button small dangerous at-delete-inline";
    del.title = "Pfad/Zwischenpfad löschen (mit Bestätigung)";
    del.innerHTML = '<i class="fas fa-minus"></i>';
    del.onclick = () => {
      _confirm({
        title: "Pfad löschen",
        html: `Möchten Sie den Pfad <b>${_escapeHtml(node.title || "(unbenannt)")}</b> wirklich löschen?`,
        confirmText: "Löschen",
        onConfirm: () => {
          const idx = parent.children.findIndex((c) => c.uid === node.uid);
          if (idx >= 0) parent.children.splice(idx, 1);
          editor.rerender();
        },
      });
    };

    header.appendChild(collapseBtn);
    header.appendChild(title);
    header.appendChild(breadcrumb);
    header.appendChild(summary);
    header.appendChild(del);
    card.appendChild(header);

    const actions = document.createElement("div");
    actions.className = "at-node-actions-row";

    const btnAddImpact = document.createElement("button");
    btnAddImpact.type = "button";
    btnAddImpact.className = "action-button small";
    btnAddImpact.title = "Legt eine neue Auswirkung (Blatt) unter diesem Pfad an (max. 5).";
    btnAddImpact.innerHTML = '<i class="fas fa-plus"></i> Auswirkung anlegen';
    btnAddImpact.onclick = () => {
      if (node.impacts.length >= 5) return;
      node.impacts.push(newImpact(""));
      editor.rerender();
    };

    const btnAddChild = document.createElement("button");
    btnAddChild.type = "button";
    btnAddChild.className = "action-button small";
    btnAddChild.title = "Legt einen Zwischenpfad unter diesem Pfad an (rekursiv).";
    btnAddChild.innerHTML = '<i class="fas fa-plus"></i> Zwischenpfad anlegen';
    btnAddChild.onclick = () => { node.children.push(newNode("", depth + 1)); editor.rerender(); };

    const maxNote = document.createElement("span");
    maxNote.className = "at-max-note";
    maxNote.title = "Maximal 5 Auswirkungen pro Pfad/Zwischenpfad";
    maxNote.textContent = `(${node.impacts.length}/5 Auswirkungen)`;

    actions.appendChild(btnAddImpact);
    actions.appendChild(btnAddChild);
    actions.appendChild(maxNote);
    card.appendChild(actions);

    if (node.collapsed) return card;

    const impactsWrap = document.createElement("div");
    impactsWrap.className = "at-impacts-container";
    node.impacts.forEach((imp) => impactsWrap.appendChild(renderImpact(editor, node, imp)));
    card.appendChild(impactsWrap);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "at-children-container";
    node.children.forEach((ch) => childrenWrap.appendChild(renderNode(editor, node, ch, depth + 1, [...crumb, node.title || "(unbenannt)"])));
    card.appendChild(childrenWrap);

    return card;
  }

  function renderImpact(editor, node, imp) {
    const card = document.createElement("div");
    card.className = "at-card at-impact-card";
    card.dataset.uid = imp.uid;

    const wrap = document.createElement("div");
    wrap.className = "leaf-container";

    const row1 = document.createElement("div");
    row1.style.display = "flex";
    row1.style.gap = "8px";
    row1.style.alignItems = "center";

    const txt = document.createElement("input");
    txt.type = "text";
    txt.className = "at-impact-text";
    txt.value = imp.text || "";
    txt.placeholder = "Auswirkung / Schritt";
    txt.title = "Name der Auswirkung (Blatt)";
    txt.oninput = () => { imp.text = txt.value; editor.updateSummaries(); };

    const del = document.createElement("button");
    del.type = "button";
    del.className = "action-button small dangerous";
    del.title = "Auswirkung löschen (mit Bestätigung)";
    del.innerHTML = '<i class="fas fa-minus"></i>';
    del.onclick = () => {
      _confirm({
        title: "Auswirkung löschen",
        html: `Möchten Sie die Auswirkung <b>${_escapeHtml(imp.text || "(unbenannt)")}</b> wirklich löschen?`,
        confirmText: "Löschen",
        onConfirm: () => {
          const idx = node.impacts.findIndex((x) => x.uid === imp.uid);
          if (idx >= 0) node.impacts.splice(idx, 1);
          editor.rerender();
        },
      });
    };

    row1.appendChild(txt);
    row1.appendChild(del);

    const ds = document.createElement("div");
    ds.className = "ds-checks";
    ds.title = "Auswirkungen auswählen (DS1..DS5).";
    ds.innerHTML = `
      <span>Impact:</span>
      ${["DS1","DS2","DS3","DS4","DS5"].map(id => {
        const checked = (imp.ds || []).includes(id) ? "checked" : "";
        return `<label title="${id}">${id}<input type="checkbox" data-ds="${id}" ${checked}></label>`;
      }).join("")}
    `;

    _qsa('input[type="checkbox"][data-ds]', ds).forEach((cb) => {
      cb.addEventListener("change", () => {
        const picked = _qsa('input[type="checkbox"][data-ds]', ds).filter(x => x.checked).map(x => x.getAttribute("data-ds"));
        imp.ds = picked;
        editor.updateSummaries();
      });
    });

    const kstu = document.createElement("div");
    kstu.className = "kstu-grid";
    kstu.title = "K/S/T/U bewerten.";
    kstu.innerHTML = `
      <select name="atv2_${imp.uid}_k" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_s" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_t" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_u" class="kstu-select"></select>
    `;

    const setSelectVal = (suffix, val) => {
      const el = _qs(`select[name="atv2_${imp.uid}_${suffix}"]`, kstu);
      if (el) el.value = val || "";
    };

    setTimeout(() => {
      setSelectVal("k", imp.k);
      setSelectVal("s", imp.s);
      setSelectVal("t", imp.t);
      setSelectVal("u", imp.u);
    }, 0);

    _qsa("select", kstu).forEach((sel) => {
      sel.addEventListener("change", () => {
        imp.k = _qs(`select[name="atv2_${imp.uid}_k"]`, kstu)?.value || "";
        imp.s = _qs(`select[name="atv2_${imp.uid}_s"]`, kstu)?.value || "";
        imp.t = _qs(`select[name="atv2_${imp.uid}_t"]`, kstu)?.value || "";
        imp.u = _qs(`select[name="atv2_${imp.uid}_u"]`, kstu)?.value || "";
        editor.updateSummaries();
      });
    });

    const sum = document.createElement("div");
    sum.className = "node-stats-box";
    sum.id = `atv2_leaf_summary_${imp.uid}`;

    wrap.appendChild(row1);
    wrap.appendChild(ds);
    wrap.appendChild(kstu);
    wrap.appendChild(sum);
    card.appendChild(wrap);

    return card;
  }

  function computeAndUpdateSummaries(editor) {
    const analysis = editor.analysis;
    if (!analysis) return;

    try { if (typeof populateAttackTreeDropdowns === "function") populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT V2] populateAttackTreeDropdowns:', e.message || e); }

    const entry = editor.getEntryData({ computeOnly: true });

    try {
      if (typeof applyImpactInheritance === "function") applyImpactInheritance(entry, analysis);
      if (typeof applyWorstCaseInheritance === "function") applyWorstCaseInheritance(entry);
    } catch (e) { console.warn('[AT V2] inheritance calc:', e.message || e); }

    const rootSum = document.getElementById("at_root_kstu_summary");
    if (rootSum && typeof _renderNodeSummaryHTML === "function") {
      rootSum.innerHTML = _renderNodeSummaryHTML(entry.kstu || {k:"",s:"",t:"",u:""}, entry.i_norm || "");
    }

    const walk = (n) => {
      const nodeSum = document.getElementById(`atv2_node_summary_${n.uid}`);
      if (nodeSum && typeof _renderNodeSummaryHTML === "function") {
        nodeSum.innerHTML = _renderNodeSummaryHTML(n.kstu || {k:"",s:"",t:"",u:""}, n.i_norm || "");
      }
      (n.impacts || []).forEach((lf) => {
        const lfSum = document.getElementById(`atv2_leaf_summary_${lf.uid}`);
        if (lfSum && typeof _renderNodeSummaryHTML === "function") {
          lfSum.innerHTML = _renderNodeSummaryHTML({k: lf.k, s: lf.s, t: lf.t, u: lf.u}, lf.i_norm || "");
        }
      });
      (n.children || []).forEach(walk);
    };
    (entry.treeV2?.children || []).forEach(walk);
  }

  function createEditor() {
    return {
      analysis: null,
      entryUid: null,
      editingId: null,
      root: newNode("", 0),
      host: null,

      init() { this.host = document.getElementById("atTreeEditorV2"); },

      open(existingEntry) {
        // `analysisData` / `activeAnalysisId` are top-level `let` in globals.js (not on window).
        const analysis = (typeof analysisData !== 'undefined' ? analysisData : []).find((a) => a.id === activeAnalysisId);
        this.analysis = analysis || null;

        this.editingId = existingEntry?.id || "";
        this.entryUid = existingEntry?.uid || _uid("risk");

        const idField = document.getElementById("at_id");
        if (idField) idField.value = this.editingId || "";

        const rootInput = _qs('input[name="at_root"]');
        if (rootInput) rootInput.value = existingEntry?.rootName || "";

        if (existingEntry?.treeV2) this.root = structuredClone(existingEntry.treeV2);
        else if (existingEntry) this.root = legacyToV2(existingEntry);
        else this.root = newNode("", 0);

        this.root.title = rootInput?.value || this.root.title || "";

        this.rerender();

        const btnAdd = document.getElementById("btnAddAttackPath");
        if (btnAdd) {
          btnAdd.onclick = () => { this.root.children.push(newNode("", 1)); this.rerender(); };
        }
      },

      rerender() {
        if (!this.host) this.init();
        if (!this.host) return;

        const rootInput = _qs('input[name="at_root"]');
        if (rootInput) this.root.title = rootInput.value || "";

        render(this, this.root);
        this.updateBreadcrumbs();

        try { if (typeof populateAttackTreeDropdowns === "function") populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT V2] populateAttackTreeDropdowns:', e.message || e); }
        this.updateSummaries();
      },

      updateBreadcrumbs() {
        const rootTitle = _qs('input[name="at_root"]')?.value || "Root";
        _qsa(".at-node-card").forEach((el) => {
          const bc = _qs(".at-breadcrumb", el);
          if (!bc) return;

          const titles = [];
          let cur = el;
          while (cur) {
            const titleEl = _qs(".at-node-title", cur);
            if (titleEl) titles.push(titleEl.value || "(unbenannt)");
            const parentCard = cur.parentElement?.closest?.(".at-node-card");
            if (!parentCard) break;
            cur = parentCard;
          }
          bc.textContent = [rootTitle, ...titles.reverse()].join(" → ");
        });
      },

      updateSummaries() { computeAndUpdateSummaries(this); },

      getEntryData({ computeOnly = false } = {}) {
        const analysis = this.analysis;

        const treeV2 = structuredClone(this.root || newNode("", 0));
        if (!treeV2.uid) treeV2.uid = _uid("node");

        const entryId = computeOnly
          ? (this.editingId || "TMP")
          : (this.editingId || generateNextRiskID(analysis));

        const entry = {
          id: entryId,
          uid: this.entryUid || _uid("risk"),
          rootName: treeV2.title || "",
          treeV2: treeV2,
          // legacy fields retained for compatibility
          treeDepth: 1,
          useDeepTree: false,
          useSecondIntermediate: false,
          useThirdIntermediate: false,
          useFourthIntermediate: false,
          branches: [],
          kstu: {k:"",s:"",t:"",u:""},
          i_norm: "",
          rootRiskValue: "0.00",
          rootRiskLevel: ""
        };

        // compute rootRiskValue after calc fills kstu/i_norm
        try {
          if (analysis && typeof applyImpactInheritance === "function") applyImpactInheritance(entry, analysis);
          if (typeof applyWorstCaseInheritance === "function") applyWorstCaseInheritance(entry);
          entry.rootRiskValue = _computeRiskScore(entry.kstu, entry.i_norm).toFixed(2);
        } catch (e) { console.warn('[AT V2] getEntryData calc:', e.message || e); }

        return entry;
      },
    };
  }

  window.atV2 = window.atV2 || createEditor();

})();