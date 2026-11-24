/*
 * Hoffman Yöntemi - Montaj Hattı Dengeleme
 * hoffman.py'deki HoffmanSolver sınıfının birebir JavaScript karşılığı.
 */
class HoffmanSolver {
    /**
     * @param {Map<string, number>} tasks  görev adı -> süre (sıra korunur)
     * @param {Array<[string, string]>} precedences  [önce, sonra]
     * @param {number} cycleTime  çevrim süresi (C)
     */
    constructor(tasks, precedences, cycleTime) {
        this.tasks = tasks;
        this.precedences = precedences;
        this.cycleTime = cycleTime;
        this.taskNames = [...tasks.keys()];
        this.n = this.taskNames.length;
        this.taskIdx = new Map(this.taskNames.map((t, i) => [t, i]));
        this.matrix = null;
        this.solutionSteps = [];
        this.stations = [];
        this.metrics = {};
    }

    // Öncelik matrisi + geçişli kapanış (Warshall). matrix[i][j] = 1 → i, j'den önce
    buildPrecedenceMatrix() {
        const n = this.n;
        const m = Array.from({ length: n }, () => new Array(n).fill(0));
        for (const [pred, succ] of this.precedences) {
            if (this.taskIdx.has(pred) && this.taskIdx.has(succ)) {
                m[this.taskIdx.get(pred)][this.taskIdx.get(succ)] = 1;
            }
        }
        for (let k = 0; k < n; k++)
            for (let i = 0; i < n; i++)
                for (let j = 0; j < n; j++)
                    if (m[i][k] && m[k][j]) m[i][j] = 1;
        this.matrix = m;
        return m;
    }

    solve() {
        this.buildPrecedenceMatrix();
        this.solutionSteps = [];
        this.stations = [];

        const unassigned = [...this.taskNames];
        let current = [];
        let remaining = this.cycleTime;
        let station = 1;
        let step = 0;
        const limit = this.n * this.n + this.n + 10;

        while (unassigned.length) {
            step++;
            if (step > limit) break; // sonsuz döngü koruması

            // Kod numaraları: atanmamış önkoşul sayısı
            const colSums = {};
            for (const task of unassigned) {
                const j = this.taskIdx.get(task);
                let code = 0;
                for (const t of unassigned) if (t !== task) code += this.matrix[this.taskIdx.get(t)][j];
                colSums[task] = code;
            }

            const eligible = unassigned.filter(t => colSums[t] === 0);
            const selected = eligible.find(t => this.tasks.get(t) <= remaining) || null;

            const info = {
                step, station,
                remainingBefore: remaining,
                colSums: { ...colSums },
                eligible: [...eligible],
                selected,
                action: null
            };

            if (selected) {
                current.push(selected);
                remaining -= this.tasks.get(selected);
                info.remainingAfter = remaining;
                unassigned.splice(unassigned.indexOf(selected), 1);
            } else {
                // Sığan uygun görev yok → istasyonu kapat, yenisini aç
                if (current.length) {
                    this.stations.push({ station, tasks: [...current], timeUsed: this.cycleTime - remaining, idleTime: remaining });
                }
                station++;
                current = [];
                remaining = this.cycleTime;
                info.action = 'new_station';
                info.remainingAfter = remaining;

                // Çevrim süresinden uzun görev: zorla ata
                if (eligible.length) {
                    const smallest = eligible.reduce((a, b) => (this.tasks.get(b) < this.tasks.get(a) ? b : a));
                    if (this.tasks.get(smallest) > this.cycleTime) {
                        current.push(smallest);
                        remaining -= this.tasks.get(smallest);
                        unassigned.splice(unassigned.indexOf(smallest), 1);
                        info.action = 'forced_assignment';
                        info.selected = smallest;
                        info.remainingAfter = remaining;
                    }
                }
            }
            this.solutionSteps.push(info);
        }

        if (current.length) {
            this.stations.push({ station, tasks: [...current], timeUsed: this.cycleTime - remaining, idleTime: Math.max(0, remaining) });
        }

        this._calculateMetrics();
        return { steps: this.solutionSteps, stations: this.stations };
    }

    _calculateMetrics() {
        const totalWork = [...this.tasks.values()].reduce((a, b) => a + b, 0);
        const k = this.stations.length;
        if (k === 0 || this.cycleTime === 0) {
            this.metrics = { totalWorkTime: totalWork, cycleTime: this.cycleTime, numStations: 0, theoreticalMin: 0, lineEfficiency: 0, balanceDelay: 100, totalIdleTime: 0 };
            return;
        }
        const eff = (totalWork / (k * this.cycleTime)) * 100;
        this.metrics = {
            totalWorkTime: totalWork,
            cycleTime: this.cycleTime,
            numStations: k,
            theoreticalMin: Math.ceil(totalWork / this.cycleTime),
            lineEfficiency: Math.round(eff * 100) / 100,
            balanceDelay: Math.round((100 - eff) * 100) / 100,
            totalIdleTime: this.stations.reduce((s, x) => s + x.idleTime, 0)
        };
    }

    validateInputs() {
        const errors = [];
        if (!this.tasks.size) errors.push('Define at least one task.');
        if (!(this.cycleTime > 0)) errors.push('Cycle time must be positive.');

        for (const [pred, succ] of this.precedences) {
            if (!this.tasks.has(pred)) errors.push(`Task '${pred}' is not defined (used in a precedence).`);
            if (!this.tasks.has(succ)) errors.push(`Task '${succ}' is not defined (used in a precedence).`);
            if (pred === succ) errors.push(`A task cannot precede itself: '${pred}'.`);
        }

        // DFS ile döngü kontrolü
        if (!errors.length) {
            const visited = new Set(), stack = new Set();
            const hasCycle = node => {
                visited.add(node); stack.add(node);
                for (const [p, s] of this.precedences) {
                    if (p !== node) continue;
                    if (!visited.has(s)) { if (hasCycle(s)) return true; }
                    else if (stack.has(s)) return true;
                }
                stack.delete(node);
                return false;
            };
            for (const t of this.tasks.keys()) {
                if (!visited.has(t) && hasCycle(t)) { errors.push('The precedence relationships contain a cycle.'); break; }
            }
        }
        return errors;
    }
}

if (typeof module !== 'undefined') module.exports = { HoffmanSolver };
