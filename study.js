/* Usability log for the Phase 2 test (at least 3 players).
   Records task time, success, and error types. Stays on this device
   and, when the game server is open, also in logs/usability.jsonl. */
(function () {
  const KEY = "biqsha-study-v1";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(rows) {
    try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-400))); } catch {}
  }
  function summary(rows) {
    const tasks = rows.filter(r => r.type === "task_end");
    const byType = {};
    rows.forEach(r => { if (String(r.type).indexOf("error") === 0) byType[r.type] = (byType[r.type] || 0) + 1; });
    return {
      events: rows.length,
      tasks: tasks.length,
      completed: tasks.filter(t => t.data && t.data.success).length,
      failed: tasks.filter(t => t.data && !t.data.success).length,
      meanTaskSec: tasks.length ? Math.round(tasks.reduce((a, t) => a + (t.data.ms || 0), 0) / tasks.length / 1000) : 0,
      errors: byType,
      helpOpens: rows.filter(r => r.type === "help").length
    };
  }
  window.BiqshaLog = {
    event(type, data) {
      const row = { t: Date.now(), type, who: (window.BiqshaWho && window.BiqshaWho()) || "", data: data || {} };
      const rows = load();
      rows.push(row);
      save(rows);
      try {
        fetch("/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) }).catch(() => {});
      } catch {}
      return row;
    },
    rows: load,
    summary() { return summary(load()); },
    download() {
      const rows = load();
      const blob = new Blob([JSON.stringify({ summary: summary(rows), events: rows }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "biqsha-usability.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    clear() { save([]); }
  };
})();
