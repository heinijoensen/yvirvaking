/**
 * users.js — Yvirvaking user registry
 * Installers, customers, on-call schedule, and pump assignments.
 * Loaded by all tiers. No server required — all in-memory.
 */
window.YV_USERS = {
  installers: [
    {
      id: 'I001', name: 'Pauli Rasmussen', initials: 'PR',
      phone: '+298 514 201', email: 'pauli@mariapoulsen.fo',
      onCall: true, role: 'senior',
      pumps: ['P001','P002','P003','P004','P005','P006','P007','P008'],
    },
    {
      id: 'I002', name: 'Jógvan Petersen', initials: 'JP',
      phone: '+298 514 202', email: 'jogvan@mariapoulsen.fo',
      onCall: false, role: 'technician',
      pumps: ['P009','P010','P011','P012','P013','P014','P015'],
    },
  ],

  // Customers auto-derived from YV.pumps (loaded after shared-data.js)
  // Access via YV_USERS.customerForPump(pumpId)

  getInstallerForPump(pumpId) {
    return this.installers.find(i => i.pumps.includes(pumpId)) || this.installers[0];
  },

  getOnCallInstaller() {
    return this.installers.find(i => i.onCall) || this.installers[0];
  },

  setOnCall(installerId) {
    this.installers.forEach(i => { i.onCall = i.id === installerId; });
    // persist so other tabs see the change
    try { localStorage.setItem('yv_oncall', installerId); } catch {}
    const bc = this._bc();
    if (bc) bc.postMessage({ type: 'oncall_changed', installerId });
  },

  _bc() {
    if (!window.BroadcastChannel) return null;
    if (!this.__bc) this.__bc = new BroadcastChannel('yv_users');
    return this.__bc;
  },

  init() {
    // Restore on-call from localStorage if present
    try {
      const saved = localStorage.getItem('yv_oncall');
      if (saved) this.installers.forEach(i => { i.onCall = i.id === saved; });
    } catch {}
    // Listen for on-call changes from other tabs
    const bc = this._bc();
    if (bc) bc.onmessage = (e) => {
      if (e.data?.type === 'oncall_changed') {
        this.installers.forEach(i => { i.onCall = i.id === e.data.installerId; });
      }
    };
  },
};

YV_USERS.init();
