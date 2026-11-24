// Hoffman arayüzü: girdi, çizim, tablo ve grafik
const $ = id => document.getElementById(id);
const PALETTE = ['#D6131D', '#E5E7EB', '#EAB308', '#22C55E', '#60A5FA', '#A78BFA', '#F97316', '#14B8A6', '#F472B6', '#9CA3AF'];
const stationColor = s => PALETTE[(s - 1) % PALETTE.length];
const fmt = n => (Math.round(n * 100) / 100).toString();

const EXAMPLE = {
    tasks: [['A', 3], ['B', 6], ['C', 4], ['D', 5], ['E', 3], ['F', 2], ['G', 5], ['H', 4]],
    prec: 'A,B\nA,C\nB,D\nC,D\nC,E\nD,F\nE,F\nF,G\nG,H',
    cycle: 12
};

let chart = null;
let lastResult = null;

// Girdi satırları
function addTask(name, time) {
    const i = $('task-list').children.length;
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
        <div class="input"><input type="text" class="t-name"></div>
        <div class="input"><input type="number" class="t-time" min="0.1" step="0.5"></div>
        <button class="btn btn-icon" type="button" title="Remove task">×</button>`;
    row.querySelector('.t-name').value = name ?? `T${i + 1}`;
    row.querySelector('.t-time').value = time ?? 1;
    row.querySelector('button').onclick = () => row.remove();
    $('task-list').appendChild(row);
}

function loadExample() {
    $('task-list').innerHTML = '';
    EXAMPLE.tasks.forEach(([n, t]) => addTask(n, t));
    $('prec').value = EXAMPLE.prec;
    $('cycle').value = EXAMPLE.cycle;
    solve();
}

function clearAll() {
    $('task-list').innerHTML = '';
    addTask('A', 3); addTask('B', 5); addTask('C', 4);
    $('prec').value = 'A,B\nA,C';
    $('cycle').value = 10;
    solve();
}

function readInputs() {
    const tasks = new Map();
    document.querySelectorAll('.task-row').forEach(r => {
        const name = r.querySelector('.t-name').value.trim();
        const time = parseFloat(r.querySelector('.t-time').value);
        if (name) tasks.set(name, isNaN(time) ? 0 : time);
    });
    const precedences = [];
    $('prec').value.trim().split('\n').forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const u = parts[0].trim(), v = parts[1].trim();
            if (u && v) precedences.push([u, v]);
        }
    });
    return { tasks, precedences, cycle: parseFloat($('cycle').value) };
}

// Çözüm
function solve() {
    const { tasks, precedences, cycle } = readInputs();
    const solver = new HoffmanSolver(tasks, precedences, cycle);
    const errors = solver.validateInputs();
    $('errors').innerHTML = '';
    if (errors.length) {
        errors.forEach(e => {
            const d = document.createElement('div');
            d.textContent = e;
            $('errors').appendChild(d);
        });
        $('results').classList.add('stale');
        return;
    }
    $('results').classList.remove('stale');

    const { steps, stations } = solver.solve();
    const m = solver.metrics;
    lastResult = { solver, steps, stations, m, tasks, precedences, cycle };

    const stationOf = {};
    stations.forEach(s => s.tasks.forEach(t => stationOf[t] = s.station));

    renderMetrics(m);
    renderDiagram(tasks, precedences, stationOf);
    renderChart(stations, cycle);
    renderStations(stations, cycle);
    renderMatrix(solver);
    renderSteps(steps, tasks);
}

function renderMetrics(m) {
    $('m-stations').textContent = m.numStations;
    $('m-theo').textContent = `Theoretical min ${m.theoreticalMin}`;
    $('m-eff').innerHTML = `${fmt(m.lineEfficiency)}<span class="u">%</span>`;
    $('m-delay').innerHTML = `${fmt(m.balanceDelay)}<span class="u">%</span>`;
    $('m-idle').textContent = fmt(m.totalIdleTime);
    $('m-work').textContent = `Work content ${fmt(m.totalWorkTime)}`;
    const k = $('k-eff');
    k.classList.remove('ok', 'warn', 'bad');
    k.classList.add(m.lineEfficiency >= 85 ? 'ok' : m.lineEfficiency >= 70 ? 'warn' : 'bad');
}

// Katmanlı öncelik diyagramı (SVG)
function renderDiagram(tasks, precedences, stationOf) {
    const names = [...tasks.keys()];
    const preds = Object.fromEntries(names.map(n => [n, []]));
    precedences.forEach(([u, v]) => { if (preds[v] && tasks.has(u)) preds[v].push(u); });

    const layer = {};
    const depth = n => {
        if (layer[n] !== undefined) return layer[n];
        layer[n] = 0;
        layer[n] = preds[n].length ? Math.max(...preds[n].map(depth)) + 1 : 0;
        return layer[n];
    };
    names.forEach(depth);

    const groups = {};
    names.forEach(n => (groups[layer[n]] ||= []).push(n));
    const nLayers = Math.max(...Object.keys(groups).map(Number)) + 1;
    const maxPer = Math.max(...Object.values(groups).map(g => g.length));

    const NW = 64, NH = 52, GX = 56, GY = 26, PAD = 20;
    const W = PAD * 2 + nLayers * NW + (nLayers - 1) * GX;
    const H = PAD * 2 + maxPer * NH + (maxPer - 1) * GY;
    const pos = {};
    Object.entries(groups).forEach(([l, g]) => {
        const colH = g.length * NH + (g.length - 1) * GY;
        g.forEach((n, i) => {
            pos[n] = { x: PAD + l * (NW + GX), y: (H - colH) / 2 + i * (NH + GY) };
        });
    });

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6B7280"/></marker></defs>`;
    precedences.forEach(([u, v]) => {
        if (!pos[u] || !pos[v]) return;
        const x1 = pos[u].x + NW, y1 = pos[u].y + NH / 2, x2 = pos[v].x - 2, y2 = pos[v].y + NH / 2;
        const mx = (x1 + x2) / 2;
        svg += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#6B7280" stroke-width="1.4" marker-end="url(#arr)"/>`;
    });
    names.forEach(n => {
        const { x, y } = pos[n];
        const s = stationOf[n];
        const c = s ? stationColor(s) : '#6B7280';
        svg += `<g>
            <rect x="${x}" y="${y}" width="${NW}" height="${NH}" fill="#111114" stroke="${c}" stroke-width="2"/>
            <rect x="${x}" y="${y}" width="${NW}" height="4" fill="${c}"/>
            <text x="${x + NW / 2}" y="${y + 26}" text-anchor="middle" class="d-name"></text>
            <text x="${x + NW / 2}" y="${y + 42}" text-anchor="middle" class="d-time">t=${fmt(tasks.get(n))}${s ? ' · S' + s : ''}</text>
        </g>`;
    });
    svg += '</svg>';
    $('diagram').innerHTML = svg;
    // Görev adlarını textContent ile yaz (HTML enjeksiyonu olmasın)
    $('diagram').querySelectorAll('.d-name').forEach((el, i) => el.textContent = names[i]);
}

function renderChart(stations, cycle) {
    const labels = stations.map(s => `S${s.station}`);
    const data = {
        labels,
        datasets: [
            { label: 'Used time', data: stations.map(s => s.timeUsed), backgroundColor: stations.map(s => stationColor(s.station)), stack: 's', barPercentage: 0.6 },
            { label: 'Idle time', data: stations.map(s => Math.max(0, s.idleTime)), backgroundColor: 'rgba(209,213,219,0.10)', borderColor: 'rgba(209,213,219,0.35)', borderWidth: 1, borderDash: [4, 3], stack: 's', barPercentage: 0.6 },
            { type: 'line', label: 'Cycle time', data: labels.map(() => cycle), borderColor: '#FF3048', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }
        ]
    };
    if (chart) { chart.data = data; chart.update(); return; }

    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 11;
    const grid = { color: 'rgba(209,213,219,0.07)' };
    chart = new Chart($('loadChart'), {
        type: 'bar',
        data,
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { align: 'end', labels: { boxWidth: 10, boxHeight: 10 } },
                tooltip: { backgroundColor: '#1C1C21', cornerRadius: 0, borderColor: 'rgba(209,213,219,0.22)', borderWidth: 1 }
            },
            scales: { x: { stacked: true, grid }, y: { stacked: true, beginAtZero: true, grid, title: { display: true, text: 'Time' } } }
        }
    });
}

function cell(tag, text, cls) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
}

function renderStations(stations, cycle) {
    const t = $('station-table');
    t.innerHTML = '';
    const head = document.createElement('tr');
    ['Station', 'Tasks', 'Used', 'Idle', 'Utilization'].forEach((h, i) => head.appendChild(cell('th', h, i >= 2 ? 'num' : '')));
    t.appendChild(head);
    stations.forEach(s => {
        const tr = document.createElement('tr');
        const st = cell('td', '');
        st.innerHTML = `<span class="sw" style="background:${stationColor(s.station)}"></span>S${s.station}`;
        tr.appendChild(st);
        tr.appendChild(cell('td', s.tasks.join(', ')));
        tr.appendChild(cell('td', fmt(s.timeUsed), 'num'));
        tr.appendChild(cell('td', fmt(s.idleTime), 'num'));
        tr.appendChild(cell('td', fmt((s.timeUsed / cycle) * 100) + '%', 'num'));
        t.appendChild(tr);
    });
}

function renderMatrix(solver) {
    const t = $('matrix');
    t.innerHTML = '';
    const names = solver.taskNames;
    const head = document.createElement('tr');
    head.appendChild(cell('th', ''));
    names.forEach(n => head.appendChild(cell('th', n, 'num')));
    t.appendChild(head);
    solver.matrix.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.appendChild(cell('th', names[i]));
        row.forEach(v => tr.appendChild(cell('td', v, 'num' + (v ? ' on' : ''))));
        t.appendChild(tr);
    });
    const sum = document.createElement('tr');
    sum.className = 'code-row';
    sum.appendChild(cell('th', 'Code no.'));
    names.forEach((_, j) => sum.appendChild(cell('td', solver.matrix.reduce((a, r) => a + r[j], 0), 'num')));
    t.appendChild(sum);
}

function renderSteps(steps, tasks) {
    const box = $('steps');
    box.innerHTML = '';
    let n = 0;
    steps.forEach(s => {
        if (s.action === 'new_station') {
            box.appendChild(cell('div', `Station ${s.station} closed → Station ${s.station + 1} opened`, 'step-sep'));
            return;
        }
        const forced = s.action === 'forced_assignment';
        const st = forced ? s.station + 1 : s.station;
        if (forced) box.appendChild(cell('div', `Station ${s.station} closed → Station ${st} opened`, 'step-sep'));
        const d = document.createElement('details');
        d.className = 'step';
        const sum = document.createElement('summary');
        sum.innerHTML = `<span class="s-no"></span><span class="s-st"></span><span class="s-sel"></span><span class="s-rem"></span>`;
        sum.querySelector('.s-no').textContent = `Step ${String(++n).padStart(2, '0')}`;
        sum.querySelector('.s-st').textContent = `S${st}`;
        sum.querySelector('.s-st').style.color = stationColor(st);
        sum.querySelector('.s-sel').textContent = `assign ${s.selected}${forced ? ' (forced, t > C)' : ''}`;
        sum.querySelector('.s-rem').textContent = `${fmt(s.remainingBefore)} → ${fmt(s.remainingAfter)}`;
        d.appendChild(sum);

        const tbl = document.createElement('table');
        tbl.className = 'data';
        const h = document.createElement('tr');
        ['Task', 'Code no.', 'Time', 'Status'].forEach((x, i) => h.appendChild(cell('th', x, i === 1 || i === 2 ? 'num' : '')));
        tbl.appendChild(h);
        Object.entries(s.colSums).forEach(([t, c]) => {
            const tr = document.createElement('tr');
            const status = t === s.selected ? 'Assigned' : s.eligible.includes(t) ? 'Eligible' : 'Waiting';
            tr.appendChild(cell('td', t));
            tr.appendChild(cell('td', c, 'num'));
            tr.appendChild(cell('td', fmt(tasks.get(t)), 'num'));
            tr.appendChild(cell('td', status, 'st-' + status.toLowerCase()));
            tbl.appendChild(tr);
        });
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        wrap.appendChild(tbl);
        d.appendChild(wrap);
        box.appendChild(d);
    });
}

function toggleSteps() {
    const all = document.querySelectorAll('#steps details');
    const open = [...all].some(d => !d.open);
    all.forEach(d => d.open = open);
}

function downloadCSV() {
    if (!lastResult) return;
    const { stations, cycle } = lastResult;
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Station', 'Tasks', 'Used Time', 'Idle Time', 'Efficiency (%)']]
        .concat(stations.map(s => [s.station, s.tasks.join(', '), s.timeUsed, s.idleTime, Math.round((s.timeUsed / cycle) * 1000) / 10]));
    const blob = new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'station_assignments.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

loadExample();
