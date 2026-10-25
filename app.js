/* Deadline Rescue: durations are stored as whole minutes. */
function buildPlan(tasks, dates, availability, today) {
  const days = dates.map(date => ({ date, capacity: availability[date] || 0, entries: [] }));
  const overdue = [], unscheduled = [];
  const rank = { high: 0, medium: 1, low: 2 };
  const pending = tasks.filter(task => !task.completed).slice().sort((a, b) =>
    a.deadline.localeCompare(b.deadline) || rank[a.priority] - rank[b.priority]);
  for (const task of pending) {
    if (task.deadline < today) { overdue.push(task); continue; }
    const units = task.steps?.length ? task.steps.filter(step => !step.completed) : [{ name: '', minutes: task.minutes }];
    let remaining = units.reduce((sum, unit) => sum + unit.minutes, 0);
    let unitIndex = 0, unitRemaining = units[0]?.minutes || 0;
    for (const day of days) {
      if (day.date < today || day.date > task.deadline) continue;
      const used = day.entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const minutes = Math.min(remaining, day.capacity - used);
      let allocation = minutes;
      while (allocation > 0 && unitIndex < units.length) {
        const slice = Math.min(allocation, unitRemaining);
        day.entries.push({ taskId: task.id, name: units[unitIndex].name ? `${task.name} · ${units[unitIndex].name}` : task.name, minutes: slice });
        allocation -= slice; unitRemaining -= slice;
        if (!unitRemaining) { unitIndex++; unitRemaining = units[unitIndex]?.minutes || 0; }
      }
      remaining -= minutes;
      if (!remaining) break;
    }
    if (remaining) unscheduled.push({ ...task, minutes: remaining,
      beyondRange: task.deadline > dates[dates.length - 1] });
  }
  return { days, overdue, unscheduled };
}

if (typeof module !== 'undefined') module.exports = { buildPlan };
if (typeof document !== 'undefined') initializePlanner();

function initializePlanner() {
  const $ = id => document.getElementById(id);
  const key = 'deadline-rescue-v1';
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = () => dateKey(new Date());
  const addDays = (date, count) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + count); return dateKey(d); };
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(`${value}T12:00:00`)) && dateKey(new Date(`${value}T12:00:00`)) === value;
  const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const duration = minutes => `${Number((minutes / 60).toFixed(2))} h`;
  const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
  let state = { tasks: [], availability: {}, start: today(), end: addDays(today(), 6) };
  let storageWarning = '';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved) {
      if (!Array.isArray(saved.tasks) || !saved.availability || typeof saved.availability !== 'object') throw new Error('Invalid saved data');
      if (!saved.tasks.every(t => t && typeof t.id === 'string' && typeof t.name === 'string' && validDate(t.deadline) && Number.isSafeInteger(t.minutes) && (t.minutes > 0 || (t.minutes === 0 && t.completed)) && ['high', 'medium', 'low'].includes(t.priority))) throw new Error('Invalid task');
      state.tasks = saved.tasks;
      for (const task of state.tasks) {
        if (!Array.isArray(task.steps) || !task.steps.every(s => s && typeof s.name === 'string' && Number.isSafeInteger(s.minutes) && s.minutes > 0)) delete task.steps;
        if (task.steps?.length) syncSteps(task);
      }
      for (const [date, minutes] of Object.entries(saved.availability)) {
        if (validDate(date) && Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440) state.availability[date] = minutes;
      }
      if (validDate(saved.start) && validDate(saved.end) && saved.start >= today() && saved.end >= saved.start && saved.end <= addDays(saved.start, 30)) {
        state.start = saved.start; state.end = saved.end;
      }
    }
  } catch { storageWarning = 'Saved data could not be loaded. Your current changes may only last for this session.'; }

  function syncSteps(task) {
    task.minutes = task.steps.filter(s => !s.completed).reduce((sum, s) => sum + s.minutes, 0);
    task.completed = task.steps.every(s => s.completed);
  }
  let stepTaskId;
  function addStepRow(step = { name: '', minutes: 15, completed: false }) {
    const row = node('div', '', 'step-editor-row');
    const name = document.createElement('input'); name.type = 'text'; name.value = step.name; name.required = true; name.maxLength = 120;
    name.placeholder = 'e.g. Review the requirements'; name.setAttribute('aria-label', 'Step name'); name.className = 'step-name';
    const minutes = document.createElement('input'); minutes.type = 'number'; minutes.min = '1'; minutes.step = '1'; minutes.max = '100000'; minutes.required = true; minutes.value = step.minutes;
    minutes.setAttribute('aria-label', 'Estimated minutes for this step'); minutes.className = 'step-minutes';
    const doneLabel = node('label', '', 'step-done-label');
    const done = document.createElement('input'); done.type = 'checkbox'; done.checked = !!step.completed; done.className = 'step-done';
    doneLabel.append(done, node('span', 'Done'));
    const remove = node('button', 'Remove', 'button'); remove.type = 'button'; remove.addEventListener('click', () => row.remove());
    row.append(name, minutes, node('small', 'min'), doneLabel, remove); $('step-editor-rows').append(row);
  }
  function openSteps(task) {
    stepTaskId = task.id; $('steps-task-name').textContent = task.name; $('step-editor-rows').replaceChildren(); error('steps-error', '');
    if (task.steps?.length) task.steps.forEach(addStepRow);
    else {
      const names = ['Understand the requirements', 'Do the main work', 'Review and finish'];
      const count = Math.min(3, task.minutes);
      const portions = count === 3 ? [Math.max(1, Math.floor(task.minutes * .2)), Math.max(1, Math.floor(task.minutes * .6))] : [];
      if (count === 3) portions.push(task.minutes - portions[0] - portions[1]);
      else for (let i = 0; i < count; i++) portions.push(1);
      portions.forEach((minutes, i) => addStepRow({ name: names[i], minutes, completed: task.completed }));
    }
    $('steps-dialog').showModal();
  }
  $('add-step-row').addEventListener('click', () => { addStepRow(); $('step-editor-rows').lastElementChild.querySelector('input').focus(); });
  $('close-steps').addEventListener('click', () => $('steps-dialog').close());
  $('steps-form').addEventListener('submit', event => {
    event.preventDefault();
    const steps = [...$('step-editor-rows').children].map(row => ({ name: row.querySelector('.step-name').value.trim(), minutes: Number(row.querySelector('.step-minutes').value), completed: row.querySelector('.step-done').checked }));
    if (!steps.length || steps.some(s => !s.name || !Number.isSafeInteger(s.minutes) || s.minutes <= 0 || s.minutes > 100000)) { error('steps-error', 'Add at least one named step with 1–100000 whole minutes.'); return; }
    const task = state.tasks.find(t => t.id === stepTaskId); if (!task) return;
    task.steps = steps; syncSteps(task); if ($('editing-task-id').value === task.id) resetForm();
    $('steps-dialog').close(); refresh();
  });
  let rescueProposal = null;
  function invalidateRescue() { rescueProposal = null; $('apply-rescue').disabled = true; $('rescue-preview').hidden = true; }
  $('rescue-day-button').addEventListener('click', () => {
    if (updatePlan() === false) { $('availability-error').scrollIntoView({ block: 'center' }); return; }
    const dates = datesInRange(); if (!dates) return;
    $('rescue-date').replaceChildren();
    for (const date of dates) { const option = node('option', formatDate(date)); option.value = date; $('rescue-date').append(option); }
    $('rescue-hours').value = (state.availability[dates[0]] || 0) / 60;
    invalidateRescue(); error('rescue-error', ''); $('rescue-dialog').showModal();
  });
  $('close-rescue').addEventListener('click', () => $('rescue-dialog').close());
  $('rescue-date').addEventListener('change', () => { $('rescue-hours').value = (state.availability[$('rescue-date').value] || 0) / 60; invalidateRescue(); });
  $('rescue-hours').addEventListener('input', invalidateRescue);
  $('preview-rescue').addEventListener('click', () => {
    invalidateRescue();
    if (!$('rescue-hours').checkValidity()) { error('rescue-error', 'Enter 0–24 hours in quarter-hour steps.'); $('rescue-hours').reportValidity(); return; }
    const dates = datesInRange(), date = $('rescue-date').value;
    if (!dates || !dates.includes(date)) { error('rescue-error', 'Choose a day inside your planning period.'); return; }
    error('rescue-error', '');
    const availability = { ...state.availability, [date]: Math.round(Number($('rescue-hours').value) * 60) };
    const before = buildPlan(state.tasks, dates, state.availability, today());
    const after = buildPlan(state.tasks, dates, availability, today());
    rescueProposal = { availability, snapshot: JSON.stringify(state), day: today() };
    const preview = $('rescue-preview'); preview.replaceChildren(); preview.hidden = false;
    const total = plan => plan.days.reduce((sum, day) => sum + day.entries.reduce((n, e) => n + e.minutes, 0), 0);
    preview.append(node('h3', 'Your revised plan'), node('p', `${formatDate(date)}: ${duration(state.availability[date] || 0)} → ${duration(availability[date])} available.`, 'hint'), node('p', `Scheduled work: ${duration(total(before))} → ${duration(total(after))}.`, 'rescue-comparison'));
    for (const day of after.days) {
      const line = node('div', '', 'rescue-preview-day'); line.append(node('strong', formatDate(day.date)));
      line.append(node('p', day.entries.length ? day.entries.map(e => `${e.name} (${duration(e.minutes)})`).join(' · ') : 'No work scheduled.'));
      preview.append(line);
    }
    for (const task of after.unscheduled) preview.append(node('p', `${task.name}: ${duration(task.minutes)} ${task.beyondRange ? 'outside this planning period' : 'still cannot fit before its deadline'}.`, 'rescue-shortfall'));
    for (const task of after.overdue) preview.append(node('p', `${task.name}: overdue; ${duration(task.minutes)} still remaining.`, 'rescue-shortfall'));
    if (!state.tasks.some(t => !t.completed)) preview.append(node('p', 'No unfinished tasks. Only your availability will change.', 'hint'));
    $('apply-rescue').disabled = false;
  });
  $('apply-rescue').addEventListener('click', () => {
    if (!rescueProposal) return;
    if (rescueProposal.snapshot !== JSON.stringify(state) || rescueProposal.day !== today()) { invalidateRescue(); error('rescue-error', 'Your plan changed. Preview it again before applying.'); return; }
    state.availability = rescueProposal.availability; invalidateRescue(); $('rescue-dialog').close(); renderAvailability();
    $('generate-plan-button').click();
  });
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { storageWarning = 'Browser storage is unavailable. Tasks work in this session but may be lost on refresh.'; }
    $('preview-note').textContent = storageWarning;
    $('preview-note').hidden = !storageWarning;
  }
  function error(id, message) { $(id).textContent = message; $(id).hidden = !message; }
  function datesInRange() {
    const start = $('plan-start').value, end = $('plan-end').value;
    if (!validDate(start) || !validDate(end) || start < today() || end < start || end > addDays(start, 30)) {
      error('availability-error', 'Choose a range starting today or later, ending within 31 days of the start.');
      return null;
    }
    const dates = [];
    for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
    error('availability-error', '');
    return dates;
  }
  function clearPlan(message) {
    $('next-task-card').hidden = true;
    $('schedule-results').hidden = true;
    $('unscheduled-section').hidden = true;
    $('overdue-section').hidden = true;
    $('plan-empty').hidden = false;
    $('plan-status').textContent = message;
  }
  function renderAvailability() {
    const dates = datesInRange();
    if (!dates) { $('availability-inputs').replaceChildren(); clearPlan('Correct the planning dates to update your plan.'); return; }
    state.start = dates[0]; state.end = dates[dates.length - 1];
    $('availability-inputs').replaceChildren();
    for (const date of dates) {
      const row = node('div', '', 'availability-row');
      const label = node('label', formatDate(date)); label.htmlFor = `hours-${date}`;
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '24'; input.step = '0.25'; input.required = true;
      input.id = `hours-${date}`; input.dataset.date = date;
      input.value = (state.availability[date] || 0) / 60;
      input.setAttribute('aria-label', `Available study hours for ${formatDate(date)}`);
      input.addEventListener('input', () => { updatePlan(); });
      row.append(label, input, node('span', 'hours', 'hint'));
      $('availability-inputs').append(row);
    }
    updatePlan();
  }
  function renderTasks() {
    const open = state.tasks.filter(t => !t.completed);
    $('task-count').textContent = open.length;
    $('work-total').textContent = duration(open.reduce((sum, task) => sum + task.minutes, 0));
    $('task-list-count').textContent = `${state.tasks.length} tasks`;
    $('tasks-empty').hidden = state.tasks.length > 0;
    $('task-list').replaceChildren();
    for (const task of state.tasks) {
      const item = node('li', '', `task-item${task.completed ? ' completed' : ''}`);
      const heading = node('div', '', 'task-heading');
      heading.append(node('h3', task.name), node('span', task.completed ? 'Completed' : `${task.priority} priority`, `priority-badge priority-${task.completed ? 'done' : task.priority}`));
      item.append(heading, node('p', `${formatDate(task.deadline)} · ${duration(task.minutes)} remaining`, 'hint'));
      const actions = node('div', '', 'task-actions');
      for (const [label, action] of [
        [task.completed ? 'Reopen' : 'Complete', () => { task.completed = !task.completed; if (task.steps?.length) { task.steps.forEach(s => s.completed = task.completed); syncSteps(task); } refresh(); }],
        [task.steps?.length ? 'Edit steps' : 'Break into steps', () => openSteps(task)],
        ['Edit', () => {
          $('editing-task-id').value = task.id; $('task-name').value = task.name;
          $('task-deadline').value = task.deadline; $('task-hours').value = task.minutes / 60;
          $('task-hours').disabled = !!task.steps?.length;
          $('task-priority').value = task.priority; $('save-task-button').textContent = 'Save changes';
          $('cancel-edit-button').hidden = false; $('task-name').focus();
        }],
        ['Delete', () => { state.tasks = state.tasks.filter(t => t.id !== task.id); if ($('editing-task-id').value === task.id) resetForm(); refresh(); }]
      ]) {
        const button = node('button', label, 'button'); button.type = 'button';
        button.setAttribute('aria-label', `${label} ${task.name}`); button.addEventListener('click', action); actions.append(button);
      }
      if (task.steps?.length) {
        const details = node('details', '', 'task-steps');
        details.append(node('summary', `${task.steps.filter(s => s.completed).length} of ${task.steps.length} steps complete`));
        task.steps.forEach((step, index) => {
          const label = node('label', '', 'step-check');
          const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!step.completed;
          checkbox.addEventListener('change', () => {
            step.completed = checkbox.checked; syncSteps(task); refresh();
            const updated = [...$('task-list').children].find(el => el.dataset.taskId === task.id);
            const disclosure = updated?.querySelector('details'); if (disclosure) disclosure.open = true;
            updated?.querySelectorAll('.step-check input')[index]?.focus();
          });
          label.append(checkbox, node('span', step.name), node('small', `${step.minutes} min`)); details.append(label);
        });
        item.append(details);
      }
      item.dataset.taskId = task.id;
      item.append(actions); $('task-list').append(item);
    }
  }
  function updatePlan() {
    $('plan-generated-notice').hidden = true;
    const dates = datesInRange();
    if (!dates) { clearPlan('Correct the planning dates to update your plan.'); save(); return false; }
    const inputs = [...$('availability-inputs').querySelectorAll('input')];
    if (inputs.length !== dates.length || inputs.some(input => !input.validity.valid)) {
      error('availability-error', 'Enter 0–24 hours for each day, in quarter-hour steps.');
      $('availability-total').textContent = '—'; clearPlan('Correct your available hours to update the plan.'); save(); return false;
    }
    for (const input of inputs) state.availability[input.dataset.date] = Math.round(Number(input.value) * 60);
    $('availability-total').textContent = duration(dates.reduce((sum, date) => sum + (state.availability[date] || 0), 0));
    save();
    if (!state.tasks.some(t => !t.completed)) { clearPlan(state.tasks.length ? 'All tasks are complete. Nice work!' : 'Add your first task to generate a plan.'); return 'empty'; }
    const plan = buildPlan(state.tasks, dates, state.availability, today());
    const nextDay = plan.days.find(day => day.entries.length);
    $('next-task-card').hidden = !nextDay;
    if (nextDay) {
      const next = nextDay.entries[0];
      $('next-task-heading').textContent = next.name;
      $('next-task-detail').textContent = `${formatDate(nextDay.date)} · ${duration(next.minutes)} planned. Ordered by deadline, then importance.`;
    }
    $('plan-empty').hidden = true; $('schedule-results').hidden = false; $('schedule-results').replaceChildren();
    let total = 0;
    for (const day of plan.days) {
      const section = node('section', '', 'schedule-day');
      const used = day.entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const heading = node('div', '', 'day-heading');
      heading.append(node('h3', formatDate(day.date)), node('span', `${duration(used)} / ${duration(day.capacity)}`, 'day-capacity'));
      section.append(heading);
      if (day.capacity > 0) {
        const capacity = node('div', '', 'capacity-summary');
        const meter = node('div', '', 'capacity-segments');
        meter.setAttribute('role', 'meter');
        meter.setAttribute('aria-valuemin', '0');
        meter.setAttribute('aria-valuemax', String(day.capacity));
        meter.setAttribute('aria-valuenow', String(used));
        meter.setAttribute('aria-label', `Study time allocated for ${formatDate(day.date)}`);
        meter.setAttribute('aria-valuetext', `${duration(used)} of ${duration(day.capacity)} scheduled`);
        for (let i = 0; i < 12; i++) {
          const segment = node('span', '', 'capacity-segment');
          segment.setAttribute('aria-hidden', 'true');
          const fill = node('span', '', 'segment-fill');
          fill.style.width = `${Math.max(0, Math.min(1, used / day.capacity * 12 - i)) * 100}%`;
          segment.append(fill); meter.append(segment);
        }
        capacity.append(meter, node('span', used === day.capacity ? 'Fully planned' : `${duration(day.capacity - used)} free`, 'capacity-caption'));
        section.append(capacity);
      }
      for (const entry of day.entries) {
        const row = node('div', '', 'schedule-entry'); row.append(node('span', entry.name), node('strong', duration(entry.minutes))); section.append(row); total += entry.minutes;
      }
      if (!day.entries.length) section.append(node('p', day.capacity ? 'No work scheduled.' : 'No study time available.', 'hint'));
      $('schedule-results').append(section);
    }
    $('plan-status').textContent = `${duration(total)} scheduled.${plan.unscheduled.length ? ' Some work needs more time; see below.' : ''}${plan.overdue.length ? ' Review your overdue tasks below.' : ''}${!dates.some(d => state.availability[d] > 0) ? ' Enter your available hours to make room for your tasks.' : ''}`;
    for (const [prefix, items] of [['unscheduled', plan.unscheduled], ['overdue', plan.overdue]]) {
      $(`${prefix}-section`).hidden = !items.length; $(`${prefix}-list`).replaceChildren();
      for (const task of items) {
        const reason = prefix === 'overdue' ? `overdue since ${formatDate(task.deadline)}` : task.beyondRange ? 'not scheduled within this planning period' : `cannot fit before ${formatDate(task.deadline)}`;
        $(`${prefix}-list`).append(node('li', `${task.name}: ${duration(task.minutes)} ${reason}.`));
      }
    }
  }
  function resetForm() {
    $('task-hours').disabled = false;
    $('task-form').reset(); $('editing-task-id').value = ''; $('save-task-button').textContent = '+ Add task';
    $('cancel-edit-button').hidden = true; error('task-error', '');
  }
  function refresh() { renderTasks(); updatePlan(); }
  $('task-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('task-name').value.trim(), deadline = $('task-deadline').value;
    const minutes = Math.round(Number($('task-hours').value) * 60);
    const existing = state.tasks.find(t => t.id === $('editing-task-id').value);
    if (!name || !validDate(deadline) || !Number.isSafeInteger(minutes) || (minutes <= 0 && !existing?.steps?.length) || !$('task-form').checkValidity()) {
      error('task-error', 'Enter a task name, valid due date, and positive hours in quarter-hour steps.'); return;
    }
    const task = { id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, deadline, minutes, priority: $('task-priority').value, completed: existing?.completed || false, ...(existing?.steps ? { steps: existing.steps } : {}) };
    if (existing) state.tasks[state.tasks.indexOf(existing)] = task; else state.tasks.push(task);
    resetForm(); refresh(); $('task-name').focus();
  });
  $('cancel-edit-button').addEventListener('click', resetForm);
  $('plan-start').min = today(); $('plan-end').min = today();
  $('plan-start').value = state.start; $('plan-end').value = state.end;
  $('plan-start').addEventListener('change', renderAvailability);
  $('plan-end').addEventListener('change', renderAvailability);
  let generationFeedbackTimer;
  $('generate-plan-button').addEventListener('click', () => {
    const result = updatePlan();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (result === false) {
      const errorMessage = $('availability-error');
      errorMessage.tabIndex = -1;
      errorMessage.focus({ preventScroll: true });
      errorMessage.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' });
      return;
    }
    const heading = $('plan-heading');
    const panel = heading.closest('.plan-panel');
    const button = $('generate-plan-button');
    clearTimeout(generationFeedbackTimer);
    heading.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
    if (result !== 'empty') {
      const notice = $('plan-generated-notice');
      notice.hidden = false;
      button.textContent = '✓ Plan generated';
      panel.classList.remove('plan-just-generated');
      void panel.offsetWidth; // Restart the short highlight for each explicit click.
      panel.classList.add('plan-just-generated');
    }
    generationFeedbackTimer = setTimeout(() => {
      button.textContent = 'Generate my plan ↗';
      panel.classList.remove('plan-just-generated');
    }, 1800);
  });
  // Recover the unsaved form from an earlier HTML-only submission, without adding duplicates.
  const query = new URLSearchParams(location.search);
  if (query.has('taskName')) {
    $('task-name').value = query.get('taskName'); $('task-deadline').value = query.get('deadline') || '';
    $('task-hours').value = query.get('hours') || ''; $('task-priority').value = query.get('priority') || 'medium';
    error('task-error', 'Your earlier entry has been recovered. Click Add task to save it.');
    try { history.replaceState(null, '', location.pathname); } catch { /* Some file browsers restrict history changes. */ }
  }
  renderTasks(); renderAvailability();
}
