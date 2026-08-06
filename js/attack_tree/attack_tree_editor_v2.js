/**
 * @file        attack_tree_editor_v2.js
 * @description Attack tree editor V2 – recursive card-based editor with variable depth
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */
(function () {
  'use strict';

  // ---------- helpers ----------
  const _uid = (prefix) => {
    try {
      if (typeof generateUID === 'function') return generateUID(prefix);
    } catch (_) {}
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  };

  const _qs = (sel, root = document) => root.querySelector(sel);
  const _qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Delegates to global escapeHtml() in utils.js (single source of truth). */
  const _escapeHtml = (str) => escapeHtml(str);
  const _t = (k) => (typeof t === 'function' ? t(k) : k);
  const _tf = (k, vars) => (typeof tf === 'function' ? tf(k, vars) : k);

  const _locRaw = (obj, field) =>
    typeof getLocalizedField === 'function'
      ? getLocalizedField(obj, field, undefined, { raw: true })
      : obj?.[field] || '';

  const _locSet = (obj, field, value, lang) => {
    if (typeof setLocalizedField === 'function') setLocalizedField(obj, field, value, lang);
    else if (obj) obj[field] = value == null ? '' : String(value);
  };

  const _primary = (obj, field) =>
    typeof getPrimaryField === 'function' ? getPrimaryField(obj, field) : obj?.[field] || '';

  const _enPlaceholder = (obj, field, fallbackPh) => {
    const lang = (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
    if (lang !== 'en') return fallbackPh;
    const de = _primary(obj, field);
    // Selectable DE hint is shown separately; keep short EN placeholder.
    return de ? fallbackPh || 'English…' : fallbackPh || 'English…';
  };

  const _syncHint = (inputEl, obj, field, fallbackPh) => {
    if (typeof syncLocalizedInputHint === 'function') {
      syncLocalizedInputHint(inputEl, obj, field, fallbackPh);
    }
  };

  /** Opens the node/leaf note modal and wires save to the given data object. */
  function _openNoteModal(dataObj, label) {
    const modal = document.getElementById('atNodeNoteModal');
    const titleEl = document.getElementById('atNodeNoteTitle');
    const textEl = document.getElementById('atNodeNoteText');
    const saveBtn = document.getElementById('atNodeNoteSaveBtn');
    if (!modal || !textEl || !saveBtn) return;
    if (titleEl) {
      const safeLabel = label || _t('at.untitled');
      titleEl.textContent = _tf('note.title.withLabel', { label: safeLabel });
    }
    textEl.value = dataObj.note || '';
    modal.style.display = 'block';
    textEl.focus();
    saveBtn.onclick = () => {
      const val = textEl.value.trim();
      dataObj.note = val || '';
      modal.style.display = 'none';
      // Update icon state
      document.querySelectorAll(`.at-note-btn[data-note-uid="${dataObj.uid}"]`).forEach((btn) => {
        btn.classList.toggle('has-note', !!val);
        btn.title = val ? _t('at.note.edit') : _t('at.note.add');
      });
    };
  }

  /** Creates a note button element for a node or leaf. */
  function _createNoteBtn(dataObj, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const hasNote = !!dataObj.note;
    btn.className = `at-note-btn${hasNote ? ' has-note' : ''}`;
    btn.dataset.noteUid = dataObj.uid;
    btn.title = hasNote ? _t('at.note.edit') : _t('at.note.add');
    btn.innerHTML = '<i class="fas fa-sticky-note"></i>';
    btn.onclick = (e) => {
      e.stopPropagation();
      _openNoteModal(dataObj, label);
    };
    return btn;
  }

  function _confirm({
    title,
    html,
    confirmText,
    confirmClass = 'primary-button dangerous',
    onConfirm,
  }) {
    const modal = document.getElementById('confirmationModal');
    const tEl = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');
    if (!modal || !tEl || !msg || !btnConfirm || !btnCancel || !btnClose) {
      if (confirm(`${title}\n\n${String(html || '').replace(/<[^>]*>/g, '')}`)) onConfirm?.();
      return;
    }

    tEl.textContent = title || _t('confirm.title');
    msg.innerHTML = html || _t('confirm.sure');
    btnConfirm.textContent = confirmText || _t('confirm.delete');
    btnConfirm.className = confirmClass;

    modal.style.display = 'block';
    btnConfirm.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;

    const close = () => (modal.style.display = 'none');
    btnCancel.onclick = close;
    btnClose.onclick = close;
    btnConfirm.onclick = () => {
      close();
      onConfirm?.();
    };
  }

  // ---------- model ----------
  function newNode(title = '', depth = 1) {
    return {
      uid: _uid('node'),
      title,
      depth,
      collapsed: false,
      kstu: { k: '', s: '', t: '', u: '' },
      i_norm: '',
      impacts: [],
      children: [],
    };
  }

  function newImpact(text = '') {
    return {
      uid: _uid('leaf'),
      text,
      ds: [],
      stride: [],
      k: '',
      s: '',
      t: '',
      u: '',
      i_norm: '',
    };
  }

  // ---------- clipboard (copy / cut / paste) & move helpers ----------
  // Shared across all editor instances. Holds one node or one impact.
  //   { mode: 'copy'|'cut', kind: 'node'|'impact', payload, sourceArr }
  let _clip = null;

  function _toast(msg, type) {
    try {
      if (typeof showToast === 'function') showToast(msg, type || 'info');
    } catch (_) {}
  }

  /** Recursively assigns fresh UIDs to a node subtree (for copy/paste). */
  function _regenNodeUids(node) {
    node.uid = _uid('node');
    (node.impacts || []).forEach((im) => {
      im.uid = _uid('leaf');
    });
    (node.children || []).forEach(_regenNodeUids);
    return node;
  }

  function _regenImpactUid(imp) {
    imp.uid = _uid('leaf');
    return imp;
  }

  /** True if `target` is `root` itself or somewhere inside its subtree. */
  function _containsNode(root, target) {
    if (!root || !target) return false;
    if (root === target) return true;
    return (root.children || []).some((c) => _containsNode(c, target));
  }

  /** Moves the element with `uid` within `arr` by `dir` (-1 up, +1 down). */
  function _moveInArray(arr, uid, dir) {
    if (!Array.isArray(arr)) return;
    const i = arr.findIndex((x) => x && x.uid === uid);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const [item] = arr.splice(i, 1);
    arr.splice(j, 0, item);
  }

  /** Small icon button factory for the inline card actions. */
  function _mkIconBtn(iconHtml, title, onClick, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'action-button small' + (extraClass ? ' ' + extraClass : '');
    b.title = title;
    b.innerHTML = iconHtml;
    b.onclick = onClick;
    return b;
  }

  /** Binds floating tooltips that escape modal overflow (fixed to viewport). */
  function _bindHoverTooltips(root) {
    _qsa('.at-hover-tooltip', root).forEach((tipSrc) => {
      const anchor = tipSrc.parentElement;
      if (!anchor || anchor.dataset.tooltipBound === '1') return;
      anchor.dataset.tooltipBound = '1';

      let floating = null;
      const show = () => {
        if (floating) return;
        floating = document.createElement('div');
        floating.className = 'at-floating-tooltip';
        floating.innerHTML = tipSrc.innerHTML;
        document.body.appendChild(floating);

        const ar = anchor.getBoundingClientRect();
        const tr = floating.getBoundingClientRect();
        let left = ar.left + ar.width / 2 - tr.width / 2;
        let top = ar.top - tr.height - 8;
        if (top < 8) top = ar.bottom + 8;
        left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tr.height - 8));
        floating.style.left = `${left}px`;
        floating.style.top = `${top}px`;
      };
      const hide = () => {
        if (floating) {
          floating.remove();
          floating = null;
        }
      };
      anchor.addEventListener('mouseenter', show);
      anchor.addEventListener('mouseleave', hide);
      anchor.addEventListener('focusin', show);
      anchor.addEventListener('focusout', hide);
    });
  }

  function _clonePayloadForCopy() {
    const data = structuredClone(_clip.payload);
    if (_clip.kind === 'node') _regenNodeUids(data);
    else _regenImpactUid(data);
    return data;
  }

  /**
   * Pastes the current clipboard content into `targetNode`.
   * If `targetNode` is null, pastes into the tree root (only nodes → attack paths).
   */
  function pasteInto(editor, targetNode) {
    if (!_clip) {
      _toast(_t('at.toast.clipEmpty'), 'warning');
      return;
    }
    const container = targetNode || editor.root;

    if (_clip.kind === 'node') {
      if (_clip.mode === 'cut') {
        if (_containsNode(_clip.payload, container)) {
          _toast(_t('at.toast.moveFail'), 'error');
          return;
        }
        if (_clip.sourceArr) {
          const i = _clip.sourceArr.indexOf(_clip.payload);
          if (i >= 0) _clip.sourceArr.splice(i, 1);
        }
        container.children.push(_clip.payload);
        _clip = null;
      } else {
        container.children.push(_clonePayloadForCopy());
      }
      editor.rerender();
      _toast(targetNode ? _t('at.toast.midPasted') : _t('at.toast.pathPasted'), 'success');
      return;
    }

    // impact
    if (!targetNode) {
      _toast(_t('at.toast.impactPasteOnly'), 'warning');
      return;
    }
    if ((container.impacts || []).length >= 10) {
      _toast(_t('at.toast.maxImpacts'), 'warning');
      return;
    }
    if (_clip.mode === 'cut') {
      if (_clip.sourceArr) {
        const i = _clip.sourceArr.indexOf(_clip.payload);
        if (i >= 0) _clip.sourceArr.splice(i, 1);
      }
      container.impacts.push(_clip.payload);
      _clip = null;
    } else {
      container.impacts.push(_clonePayloadForCopy());
    }
    editor.rerender();
    _toast(_t('at.toast.impactPasted'), 'success');
  }

  // ---------- legacy -> v2 conversion ----------
  function _getLegacyDepth(entry) {
    try {
      if (typeof _getTreeDepthForData === 'function') return _getTreeDepthForData(entry);
    } catch (_) {}
    const d = parseInt(entry?.treeDepth, 10);
    if (d === 4) return 4;
    if (d === 3) return entry?.useThirdIntermediate === true ? 3 : 2;
    if (d === 2) return 2;
    return 1;
  }

  function _leafCloneWithUid(leaf) {
    const l = Object.assign({}, leaf || {});
    if (!l.uid) l.uid = _uid('leaf');
    if (!Array.isArray(l.ds)) l.ds = [];
    if (!Array.isArray(l.stride)) l.stride = [];
    if (l.text == null) l.text = l.name || '';
    if (l.k == null) l.k = '';
    if (l.s == null) l.s = '';
    if (l.t == null) l.t = '';
    if (l.u == null) l.u = '';
    if (l.i_norm == null) l.i_norm = '';
    return l;
  }

  function legacyToV2(entry) {
    const root = newNode(entry?.rootName || '', 0);
    root.uid = entry?.treeV2?.uid || root.uid;

    const depth = _getLegacyDepth(entry);
    const branches = Array.isArray(entry?.branches) ? entry.branches : [];

    branches.forEach((b) => {
      if (!b || !b.name) return;
      const path = newNode(b.name, 1);

      if (depth === 1) {
        (Array.isArray(b.leaves) ? b.leaves : []).forEach((lf) =>
          path.impacts.push(_leafCloneWithUid(lf))
        );
        root.children.push(path);
        return;
      }

      if (depth === 2) {
        let nodes = [];
        if (Array.isArray(b.l2_nodes) && b.l2_nodes.length) nodes = b.l2_nodes;
        else if (b.l2_node)
          nodes = [
            { name: b.l2_node?.name || '', leaves: Array.isArray(b.leaves) ? b.leaves : [] },
          ];
        else nodes = [{ name: '', leaves: Array.isArray(b.leaves) ? b.leaves : [] }];

        nodes.forEach((n) => {
          const nm = (n?.name || '').trim();
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

      const isDepth4 = depth === 4;

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
          const name = (nm || '').trim();
          if (!name) return;
          const nn = newNode(name, cur.depth + 1);
          cur.children.push(nn);
          cur = nn;
        });
        (leaves || []).forEach((lf) => cur.impacts.push(_leafCloneWithUid(lf)));
      };

      const aNames = [
        b?.l2_node?.name || '',
        b?.l3_node?.name || '',
        isDepth4 ? b?.l4_node?.name || '' : '',
      ];
      chainAttach(path, aNames, getLeavesA());

      const bNames = [
        b?.l2b_node?.name || '',
        b?.l3b_node?.name || '',
        isDepth4 ? b?.l4b_node?.name || '' : '',
      ];
      const leavesB = getLeavesB();
      if (bNames.some((x) => (x || '').trim() !== '') || (leavesB && leavesB.length)) {
        chainAttach(path, bNames, leavesB);
      }

      root.children.push(path);
    });

    return root;
  }

  // ---------- render ----------
  function render(editor, rootNode) {
    const host = editor.host;
    host.innerHTML = '';
    rootNode.children.forEach((n) =>
      host.appendChild(renderNode(editor, rootNode, n, 1, [rootNode.title || 'Root']))
    );
    _bindHoverTooltips(host);
  }

  function renderNode(editor, parent, node, depth, crumb) {
    const card = document.createElement('div');
    card.className = 'at-card at-node-card';
    card.dataset.uid = node.uid;
    card.dataset.depth = String(depth);

    const header = document.createElement('div');
    header.className = 'at-card-header';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'action-button small';
    collapseBtn.title = node.collapsed ? _t('at.expand') : _t('at.collapse');
    collapseBtn.innerHTML = node.collapsed
      ? '<i class="fas fa-chevron-right"></i>'
      : '<i class="fas fa-chevron-down"></i>';
    collapseBtn.onclick = () => {
      node.collapsed = !node.collapsed;
      editor.rerender();
    };

    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'at-node-title';
    title.value = _locRaw(node, 'title');
    const titlePh = depth === 1 ? _t('at.ph.path') : _t('at.ph.mid');
    title.placeholder = _enPlaceholder(node, 'title', titlePh);
    title.title = depth === 1 ? _t('at.title.path') : _t('at.title.mid');
    title.oninput = () => {
      _locSet(node, 'title', title.value);
      _syncHint(title, node, 'title', titlePh);
      editor.updateBreadcrumbs();
      editor.updateSummaries();
    };

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'at-breadcrumb';
    breadcrumb.title = _t('at.breadcrumb');
    breadcrumb.textContent = [...crumb, node.title || _t('at.untitled')].join(' → ');

    const summary = document.createElement('div');
    summary.className = 'node-stats-box at-node-summary';
    summary.id = `atv2_node_summary_${node.uid}`;
    summary.style.width = '220px';
    summary.style.marginTop = '0';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'action-button small dangerous at-delete-inline';
    del.title = _t('at.path.delete.titleTip');
    del.innerHTML = '<i class="fas fa-minus"></i>';
    del.onclick = () => {
      _confirm({
        title: _t('at.path.delete.title'),
        html: _tf('at.path.delete.message', { name: _escapeHtml(node.title || _t('at.untitled')) }),
        confirmText: _t('confirm.delete'),
        onConfirm: () => {
          const idx = parent.children.findIndex((c) => c.uid === node.uid);
          if (idx >= 0) parent.children.splice(idx, 1);
          editor.rerender();
        },
      });
    };

    header.appendChild(collapseBtn);
    header.appendChild(title);
    _syncHint(title, node, 'title', titlePh);
    header.appendChild(breadcrumb);
    header.appendChild(summary);
    header.appendChild(_createNoteBtn(node, node.title || _t('at.kind.path')));
    header.appendChild(del);
    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'at-node-actions-row';

    const btnAddImpact = document.createElement('button');
    btnAddImpact.type = 'button';
    btnAddImpact.className = 'action-button small';
    btnAddImpact.title = _t('at.btn.addImpactTip');
    btnAddImpact.innerHTML = `<i class="fas fa-plus"></i> ${_t('at.btn.addImpact')}`;
    btnAddImpact.onclick = () => {
      if (node.impacts.length >= 10) return;
      node.impacts.push(newImpact(''));
      editor.rerender();
    };

    const btnAddChild = document.createElement('button');
    btnAddChild.type = 'button';
    btnAddChild.className = 'action-button small';
    btnAddChild.title = _t('at.btn.addMidTip');
    btnAddChild.innerHTML = `<i class="fas fa-plus"></i> ${_t('at.btn.addMid')}`;
    btnAddChild.onclick = () => {
      node.children.push(newNode('', depth + 1));
      editor.rerender();
    };

    const isPath = depth === 1;
    const kindLabel = isPath ? _t('at.kind.path') : _t('at.kind.mid');

    const btnPaste = _mkIconBtn(
      `<i class="fas fa-paste"></i> ${_t('at.btn.paste')}`,
      _t('at.btn.pasteTip'),
      () => pasteInto(editor, node)
    );

    const btnCopy = _mkIconBtn(
      '<i class="fas fa-copy"></i>',
      _tf('at.copy.tip', { kind: kindLabel }),
      () => {
        _clip = { mode: 'copy', kind: 'node', payload: structuredClone(node) };
        _toast(_tf('at.toast.copied', { kind: kindLabel }), 'info');
      }
    );

    const btnCut = _mkIconBtn(
      '<i class="fas fa-cut"></i>',
      _tf('at.cut.tip', { kind: kindLabel }),
      () => {
        _clip = { mode: 'cut', kind: 'node', payload: node, sourceArr: parent.children };
        _toast(_tf('at.toast.cut', { kind: kindLabel }), 'info');
      }
    );

    const btnUp = _mkIconBtn(
      '<i class="fas fa-arrow-up"></i>',
      _tf('at.move.up', { kind: kindLabel }),
      () => {
        _moveInArray(parent.children, node.uid, -1);
        editor.rerender();
      }
    );

    const btnDown = _mkIconBtn(
      '<i class="fas fa-arrow-down"></i>',
      _tf('at.move.down', { kind: kindLabel }),
      () => {
        _moveInArray(parent.children, node.uid, 1);
        editor.rerender();
      }
    );

    const maxNote = document.createElement('span');
    maxNote.className = 'at-max-note';
    maxNote.title = _t('at.maxImpactsTip');
    maxNote.textContent = _tf('at.maxImpacts', { n: node.impacts.length });

    actions.appendChild(btnAddImpact);
    actions.appendChild(btnAddChild);
    actions.appendChild(btnPaste);
    actions.appendChild(btnCopy);
    actions.appendChild(btnCut);
    actions.appendChild(btnUp);
    actions.appendChild(btnDown);
    actions.appendChild(maxNote);
    card.appendChild(actions);

    if (node.collapsed) return card;

    const impactsWrap = document.createElement('div');
    impactsWrap.className = 'at-impacts-container';
    node.impacts.forEach((imp) => impactsWrap.appendChild(renderImpact(editor, node, imp)));
    card.appendChild(impactsWrap);

    const childrenWrap = document.createElement('div');
    childrenWrap.className = 'at-children-container';
    node.children.forEach((ch) =>
      childrenWrap.appendChild(
        renderNode(editor, node, ch, depth + 1, [...crumb, node.title || _t('at.untitled')])
      )
    );
    card.appendChild(childrenWrap);

    return card;
  }

  function renderImpact(editor, node, imp) {
    const card = document.createElement('div');
    card.className = 'at-card at-impact-card';
    card.dataset.uid = imp.uid;

    const wrap = document.createElement('div');
    wrap.className = 'leaf-container';

    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '8px';
    row1.style.alignItems = 'center';

    const txt = document.createElement('input');
    txt.type = 'text';
    txt.className = 'at-impact-text';
    txt.value = _locRaw(imp, 'text');
    const impactPh = _t('at.ph.impact');
    txt.placeholder = _enPlaceholder(imp, 'text', impactPh);
    txt.title = _t('at.title.impact');
    txt.oninput = () => {
      _locSet(imp, 'text', txt.value);
      _syncHint(txt, imp, 'text', impactPh);
      editor.updateSummaries();
    };

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'action-button small dangerous';
    del.title = _t('at.impact.delete.titleTip');
    del.innerHTML = '<i class="fas fa-minus"></i>';
    del.onclick = () => {
      _confirm({
        title: _t('at.impact.delete.title'),
        html: _tf('at.impact.delete.message', { name: _escapeHtml(imp.text || _t('at.untitled')) }),
        confirmText: _t('confirm.delete'),
        onConfirm: () => {
          const idx = node.impacts.findIndex((x) => x.uid === imp.uid);
          if (idx >= 0) node.impacts.splice(idx, 1);
          editor.rerender();
        },
      });
    };

    const impactKind = _t('at.kind.impact');
    const impUp = _mkIconBtn(
      '<i class="fas fa-arrow-up"></i>',
      _tf('at.move.up', { kind: impactKind }),
      () => {
        _moveInArray(node.impacts, imp.uid, -1);
        editor.rerender();
      }
    );
    const impDown = _mkIconBtn(
      '<i class="fas fa-arrow-down"></i>',
      _tf('at.move.down', { kind: impactKind }),
      () => {
        _moveInArray(node.impacts, imp.uid, 1);
        editor.rerender();
      }
    );
    const impCopy = _mkIconBtn(
      '<i class="fas fa-copy"></i>',
      _tf('at.copy.tip', { kind: impactKind }),
      () => {
        _clip = { mode: 'copy', kind: 'impact', payload: structuredClone(imp) };
        _toast(_t('at.toast.impactCopied'), 'info');
      }
    );
    const impCut = _mkIconBtn(
      '<i class="fas fa-cut"></i>',
      _tf('at.cut.tip', { kind: impactKind }),
      () => {
        _clip = { mode: 'cut', kind: 'impact', payload: imp, sourceArr: node.impacts };
        _toast(_t('at.toast.impactCut'), 'info');
      }
    );

    row1.appendChild(txt);
    _syncHint(txt, imp, 'text', impactPh);
    row1.appendChild(_createNoteBtn(imp, imp.text || impactKind));
    row1.appendChild(impUp);
    row1.appendChild(impDown);
    row1.appendChild(impCopy);
    row1.appendChild(impCut);
    row1.appendChild(del);

    const ds = document.createElement('div');
    ds.className = 'ds-checks';
    const dsList =
      typeof getDisplayDamageScenarios === 'function'
        ? getDisplayDamageScenarios(editor.analysis)
        : [];
    ds.innerHTML = `
      <span class="ds-checks-label">Impact:</span>
      ${dsList
        .map((dsItem) => {
          const checked = (imp.ds || []).includes(dsItem.id) ? 'checked' : '';
          const short =
            typeof getLocalizedField === 'function'
              ? getLocalizedField(dsItem, 'short', undefined, { fallback: true }) ||
                dsItem.short ||
                ''
              : dsItem.short || '';
          const name =
            typeof getLocalizedField === 'function'
              ? getLocalizedField(dsItem, 'name', undefined, { fallback: true }) ||
                dsItem.name ||
                dsItem.id
              : dsItem.name || dsItem.id;
          const desc =
            typeof getLocalizedField === 'function'
              ? getLocalizedField(dsItem, 'description', undefined, { fallback: true }) ||
                dsItem.description ||
                ''
              : dsItem.description || '';
          const label = short ? `${dsItem.id} (${short})` : dsItem.id;
          const tipTitle = _escapeHtml(`${dsItem.id}: ${name}`);
          const tipCat = short ? `(${_escapeHtml(short)})` : '';
          const tipDesc = _escapeHtml(desc);
          return `<label class="ds-tag" tabindex="0">
          <span class="at-hover-tooltip"><strong>${tipTitle}</strong>${tipCat ? `<br>${tipCat}` : ''}<br>${tipDesc}</span>
          ${_escapeHtml(label)}<input type="checkbox" data-ds="${dsItem.id}" ${checked}>
        </label>`;
        })
        .join('')}
    `;

    _qsa('input[type="checkbox"][data-ds]', ds).forEach((cb) => {
      cb.addEventListener('change', () => {
        const picked = _qsa('input[type="checkbox"][data-ds]', ds)
          .filter((x) => x.checked)
          .map((x) => x.getAttribute('data-ds'));
        imp.ds = picked;
        editor.updateSummaries();
      });
    });

    const strideWrap = document.createElement('div');
    strideWrap.className = 'stride-checks';
    const _strideFallback = [
      {
        id: 'S',
        name: 'Spoofing (Identitätstäuschung)',
        name_en: 'Spoofing (identity deception)',
        short: 'S',
        description:
          'Kann sich ein Angreifer oder ein fremdes Gerät als vertrauenswürdiger Teilnehmer ausgeben, um Zugriff zu erhalten? (z.\u00a0B. ein gefälschtes Servicetool).',
        description_en:
          'Can an attacker or foreign device impersonate a trusted participant to gain access? (e.g. a forged service tool).',
      },
      {
        id: 'T',
        name: 'Tampering (Manipulation)',
        name_en: 'Tampering (manipulation)',
        short: 'T',
        description:
          'Können Daten, Parameter, Konfigurationen oder die Firmware auf dem Gerät oder während der Übertragung unbefugt verändert werden?',
        description_en:
          'Can data, parameters, configurations or firmware on the device or in transit be changed without authorisation?',
      },
      {
        id: 'R',
        name: 'Repudiation (Abstreitbarkeit)',
        name_en: 'Repudiation (non-repudiation gap)',
        short: 'R',
        description:
          'Können kritische Aktionen durchgeführt werden, ohne dass wir im Nachhinein nachweisen können, wer es war? (Fehlende oder manipulierbare Logs).',
        description_en:
          'Can critical actions be performed without us later being able to prove who did them? (Missing or tamperable logs).',
      },
      {
        id: 'I',
        name: 'Information Disclosure (Informationsenthüllung)',
        name_en: 'Information Disclosure',
        short: 'I',
        description:
          'Können schützenswerte Informationen (z.\u00a0B. Passwörter, Rezepturen, Kundendaten oder Know-how) von Unbefugten ausgelesen werden?',
        description_en:
          'Can sensitive information (e.g. passwords, recipes, customer data or know-how) be read by unauthorised parties?',
      },
      {
        id: 'D',
        name: 'Denial of Service (Dienstverweigerung)',
        name_en: 'Denial of Service',
        short: 'D',
        description:
          'Kann das System so sabotiert oder überlastet werden, dass es seine Funktion einstellt oder träge wird? (z.\u00a0B. Blockade der Steuerung).',
        description_en:
          'Can the system be sabotaged or overloaded so that it stops working or becomes sluggish? (e.g. blocking the controller).',
      },
      {
        id: 'E',
        name: 'Elevation of Privilege (Rechteausweitung)',
        name_en: 'Elevation of Privilege',
        short: 'E',
        description:
          'Kann ein Nutzer mit geringen Rechten (z.\u00a0B. Gast/Operator) Berechtigungen erlangen, die ihm nicht zustehen (z.\u00a0B. Admin-/Service-Rechte)?',
        description_en:
          'Can a low-privilege user (e.g. guest/operator) obtain permissions they should not have (e.g. admin/service rights)?',
      },
    ];
    const strideCats =
      typeof window.ASSESSMENT_CONFIG !== 'undefined' && window.ASSESSMENT_CONFIG?.strideCategories
        ? window.ASSESSMENT_CONFIG.strideCategories
        : _strideFallback;
    strideWrap.innerHTML = `
      <span class="stride-label">STRIDE:</span>
      ${strideCats
        .map((cat) => {
          const checked = (imp.stride || []).includes(cat.id) ? 'checked' : '';
          const tipName = _escapeHtml(
            typeof getLocalizedField === 'function'
              ? getLocalizedField(cat, 'name', undefined, { fallback: true }) || cat.name || cat.id
              : cat.name || cat.id
          );
          const tipDesc = _escapeHtml(
            typeof getLocalizedField === 'function'
              ? getLocalizedField(cat, 'description', undefined, { fallback: true }) ||
                  cat.description ||
                  ''
              : cat.description || ''
          );
          return `<label class="stride-tag ${checked ? 'stride-active' : ''}" data-stride-id="${cat.id}" tabindex="0"><span class="at-hover-tooltip"><strong>${tipName}</strong><br>${tipDesc}</span>${cat.short}<input type="checkbox" data-stride="${cat.id}" ${checked} class="stride-cb"></label>`;
        })
        .join('')}
    `;
    _qsa('input[type="checkbox"][data-stride]', strideWrap).forEach((cb) => {
      cb.addEventListener('change', () => {
        const picked = _qsa('input[type="checkbox"][data-stride]', strideWrap)
          .filter((x) => x.checked)
          .map((x) => x.getAttribute('data-stride'));
        imp.stride = picked;
        _qsa('.stride-tag', strideWrap).forEach((lbl) => {
          const id = lbl.querySelector('input')?.getAttribute('data-stride');
          lbl.classList.toggle('stride-active', picked.includes(id));
        });
        editor.updateSummaries();
      });
    });

    const kstu = document.createElement('div');
    kstu.className = 'kstu-grid';
    kstu.title = _t('at.kstuTip');
    kstu.innerHTML = `
      <select name="atv2_${imp.uid}_k" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_s" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_t" class="kstu-select"></select>
      <select name="atv2_${imp.uid}_u" class="kstu-select"></select>
    `;

    const setSelectVal = (suffix, val) => {
      const el = _qs(`select[name="atv2_${imp.uid}_${suffix}"]`, kstu);
      if (el) el.value = val || '';
    };

    setTimeout(() => {
      setSelectVal('k', imp.k);
      setSelectVal('s', imp.s);
      setSelectVal('t', imp.t);
      setSelectVal('u', imp.u);
    }, 0);

    _qsa('select', kstu).forEach((sel) => {
      sel.addEventListener('change', () => {
        imp.k = _qs(`select[name="atv2_${imp.uid}_k"]`, kstu)?.value || '';
        imp.s = _qs(`select[name="atv2_${imp.uid}_s"]`, kstu)?.value || '';
        imp.t = _qs(`select[name="atv2_${imp.uid}_t"]`, kstu)?.value || '';
        imp.u = _qs(`select[name="atv2_${imp.uid}_u"]`, kstu)?.value || '';
        editor.updateSummaries();
      });
    });

    const sum = document.createElement('div');
    sum.className = 'node-stats-box';
    sum.id = `atv2_leaf_summary_${imp.uid}`;

    wrap.appendChild(row1);
    wrap.appendChild(ds);
    wrap.appendChild(strideWrap);
    wrap.appendChild(kstu);
    wrap.appendChild(sum);
    card.appendChild(wrap);

    return card;
  }

  function computeAndUpdateSummaries(editor) {
    const analysis = editor.analysis;
    if (!analysis) return;

    try {
      if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns();
    } catch (e) {
      console.warn('[AT V2] populateAttackTreeDropdowns:', e.message || e);
    }

    const entry = editor.getEntryData({ computeOnly: true });

    try {
      if (typeof applyImpactInheritance === 'function') applyImpactInheritance(entry, analysis);
      if (typeof applyWorstCaseInheritance === 'function') applyWorstCaseInheritance(entry);
    } catch (e) {
      console.warn('[AT V2] inheritance calc:', e.message || e);
    }

    const rootSum = document.getElementById('at_root_kstu_summary');
    if (rootSum && typeof _renderNodeSummaryHTML === 'function') {
      rootSum.innerHTML = _renderNodeSummaryHTML(
        entry.kstu || { k: '', s: '', t: '', u: '' },
        entry.i_norm || ''
      );
    }

    const walk = (n) => {
      const nodeSum = document.getElementById(`atv2_node_summary_${n.uid}`);
      if (nodeSum && typeof _renderNodeSummaryHTML === 'function') {
        nodeSum.innerHTML = _renderNodeSummaryHTML(
          n.kstu || { k: '', s: '', t: '', u: '' },
          n.i_norm || ''
        );
      }
      (n.impacts || []).forEach((lf) => {
        const lfSum = document.getElementById(`atv2_leaf_summary_${lf.uid}`);
        if (lfSum && typeof _renderNodeSummaryHTML === 'function') {
          let html = _renderNodeSummaryHTML(
            { k: lf.k, s: lf.s, t: lf.t, u: lf.u },
            lf.i_norm || ''
          );
          if (Array.isArray(lf.stride) && lf.stride.length > 0) {
            html += `<div class="ns-row" style="color:#2980b9;font-weight:600">STRIDE: ${lf.stride.join(', ')}</div>`;
          }
          lfSum.innerHTML = html;
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
      root: newNode('', 0),
      host: null,

      init() {
        this.host = document.getElementById('atTreeEditorV2');
      },

      open(existingEntry) {
        const analysis = typeof getActiveAnalysis === 'function' ? getActiveAnalysis() : null;
        this.analysis = analysis || null;

        this.editingId = existingEntry?.id || '';
        this.entryUid = existingEntry?.uid || _uid('risk');

        const idField = document.getElementById('at_id');
        if (idField) idField.value = this.editingId || '';

        if (existingEntry?.treeV2) this.root = structuredClone(existingEntry.treeV2);
        else if (existingEntry) this.root = legacyToV2(existingEntry);
        else this.root = newNode('', 0);

        // Primary DE rootName stays canonical; optional rootName_en / title_en
        if (existingEntry) {
          if (existingEntry.rootName != null && existingEntry.rootName !== '') {
            this.root.title = existingEntry.rootName;
          }
          const en =
            existingEntry.rootName_en != null
              ? existingEntry.rootName_en
              : existingEntry.treeV2 && existingEntry.treeV2.title_en;
          if (en != null && en !== '') this.root.title_en = en;
        }

        const rootInput = _qs('input[name="at_root"]');
        if (rootInput) {
          const rootPh = 'z.B. Manipulation der Firmware';
          rootInput.value = _locRaw(this.root, 'title');
          rootInput.placeholder = _enPlaceholder(this.root, 'title', rootPh);
          rootInput.oninput = () => {
            _locSet(this.root, 'title', rootInput.value || '');
            _syncHint(rootInput, this.root, 'title', rootPh);
            try {
              this.updateBreadcrumbs();
            } catch (_) {}
          };
          _syncHint(rootInput, this.root, 'title', rootPh);
        }

        // Sanitize orphan DS references (DS that were deleted since the tree was saved)
        if (existingEntry && analysis && typeof sanitizeEntryDsReferences === 'function') {
          const validIds = new Set(
            typeof getAllDamageScenarioIds === 'function' ? getAllDamageScenarioIds(analysis) : []
          );
          if (validIds.size > 0) {
            const wrapper = { treeV2: this.root, branches: existingEntry.branches || [] };
            sanitizeEntryDsReferences(wrapper, validIds);
          }
        }

        this.rerender();

        const btnAdd = document.getElementById('btnAddAttackPath');
        if (btnAdd) {
          btnAdd.onclick = () => {
            this.root.children.push(newNode('', 1));
            this.rerender();
          };
        }

        const btnPastePath = document.getElementById('btnPasteAttackPath');
        if (btnPastePath) {
          btnPastePath.onclick = () => pasteInto(this, null);
        }
      },

      rerender() {
        if (!this.host) this.init();
        if (!this.host) return;

        const rootInput = _qs('input[name="at_root"]');
        const rootPh = 'z.B. Manipulation der Firmware';
        if (rootInput) {
          _locSet(this.root, 'title', rootInput.value || '');
          _syncHint(rootInput, this.root, 'title', rootPh);
        }

        render(this, this.root);
        this.updateBreadcrumbs();

        try {
          if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns();
        } catch (e) {
          console.warn('[AT V2] populateAttackTreeDropdowns:', e.message || e);
        }
        this.updateSummaries();
      },

      flushLocalizedInputs(lang) {
        const rootInput = _qs('input[name="at_root"]');
        if (rootInput) _locSet(this.root, 'title', rootInput.value || '', lang);
        if (!this.host) return;
        _qsa('.at-node-card', this.host).forEach((card) => {
          const uid = card.dataset.uid;
          const node = uid ? _findNodeByUid(this.root, uid) : null;
          const titleEl = _qs('.at-node-title', card);
          if (node && titleEl) _locSet(node, 'title', titleEl.value || '', lang);
        });
        _qsa('.at-impact-card', this.host).forEach((card) => {
          const uid = card.dataset.uid;
          const imp = uid ? _findImpactByUid(this.root, uid) : null;
          const txtEl = _qs('.at-impact-text', card);
          if (imp && txtEl) _locSet(imp, 'text', txtEl.value || '', lang);
        });
      },

      reloadLocalizedInputs() {
        const rootInput = _qs('input[name="at_root"]');
        if (rootInput) {
          const rootPh = 'z.B. Manipulation der Firmware';
          rootInput.value = _locRaw(this.root, 'title');
          rootInput.placeholder = _enPlaceholder(this.root, 'title', rootPh);
          _syncHint(rootInput, this.root, 'title', rootPh);
        }
        this.rerender();
      },

      updateBreadcrumbs() {
        const displayRoot =
          typeof getLocalizedField === 'function'
            ? getLocalizedField(this.root, 'title') || 'Root'
            : this.root.title || 'Root';
        _qsa('.at-node-card').forEach((el) => {
          const bc = _qs('.at-breadcrumb', el);
          if (!bc) return;

          const titles = [];
          let cur = el;
          while (cur) {
            const uid = cur.dataset.uid;
            const node = uid ? _findNodeByUid(this.root, uid) : null;
            if (node && typeof getLocalizedField === 'function') {
              titles.push(getLocalizedField(node, 'title') || _t('at.untitled'));
            } else {
              const titleEl = _qs('.at-node-title', cur);
              if (titleEl) titles.push(titleEl.value || _t('at.untitled'));
            }
            const parentCard = cur.parentElement?.closest?.('.at-node-card');
            if (!parentCard) break;
            cur = parentCard;
          }
          bc.textContent = [displayRoot, ...titles.reverse()].join(' → ');
        });
      },

      updateSummaries() {
        computeAndUpdateSummaries(this);
      },

      getEntryData({ computeOnly = false } = {}) {
        const analysis = this.analysis;

        this.flushLocalizedInputs();

        const treeV2 = structuredClone(this.root || newNode('', 0));
        if (!treeV2.uid) treeV2.uid = _uid('node');

        const entryId = computeOnly
          ? this.editingId || 'TMP'
          : this.editingId || generateNextRiskID(analysis);

        const entry = {
          id: entryId,
          uid: this.entryUid || _uid('risk'),
          rootName: treeV2.title || '',
          rootName_en: treeV2.title_en || '',
          treeV2: treeV2,
          // legacy fields retained for compatibility
          treeDepth: 1,
          useDeepTree: false,
          useSecondIntermediate: false,
          useThirdIntermediate: false,
          useFourthIntermediate: false,
          branches: [],
          kstu: { k: '', s: '', t: '', u: '' },
          i_norm: '',
          rootRiskValue: '0.00',
          rootRiskLevel: '',
        };

        // compute rootRiskValue after calc fills kstu/i_norm
        try {
          if (analysis && typeof applyImpactInheritance === 'function')
            applyImpactInheritance(entry, analysis);
          if (typeof applyWorstCaseInheritance === 'function') applyWorstCaseInheritance(entry);
          entry.rootRiskValue = _computeRiskScore(entry.kstu, entry.i_norm).toFixed(2);
        } catch (e) {
          console.warn('[AT V2] getEntryData calc:', e.message || e);
        }

        return entry;
      },
    };
  }

  function _findNodeByUid(root, uid) {
    if (!root || !uid) return null;
    if (root.uid === uid) return root;
    for (const ch of root.children || []) {
      const found = _findNodeByUid(ch, uid);
      if (found) return found;
    }
    return null;
  }

  function _findImpactByUid(root, uid) {
    if (!root || !uid) return null;
    for (const im of root.impacts || []) {
      if (im.uid === uid) return im;
    }
    for (const ch of root.children || []) {
      const found = _findImpactByUid(ch, uid);
      if (found) return found;
    }
    return null;
  }

  window.atV2 = window.atV2 || createEditor();
})();
