"""
Hoffman Yöntemi - Montaj Hattı Dengeleme Algoritması
=====================================================

CIM (Bilgisayarla Bütünleşik İmalat) dersi kapsamında kullanılan
Hoffman sezgisel yöntemiyle montaj hattı dengeleme çözücüsü.
"""

import numpy as np
import pandas as pd
import math
from typing import Dict, List, Tuple, Optional


class HoffmanSolver:
    """
    Hoffman sezgisel yöntemi ile montaj hattı dengeleme problemi çözücüsü.

    Parameters
    ----------
    tasks : dict
        Görev isimleri ve süreleri. Örn: {'A': 3, 'B': 6, 'C': 4}
    precedences : list of tuple
        Öncelik ilişkileri. Örn: [('A', 'B'), ('A', 'C')]
    cycle_time : float
        Çevrim süresi (C)
    """

    def __init__(self, tasks: Dict[str, float], precedences: List[Tuple[str, str]], cycle_time: float):
        self.tasks = tasks
        self.precedences = precedences
        self.cycle_time = cycle_time

        self.task_names = list(self.tasks.keys())
        self.n = len(self.task_names)
        self.task_idx = {name: i for i, name in enumerate(self.task_names)}

        self.matrix: Optional[np.ndarray] = None
        self.solution_steps: List[dict] = []
        self.stations: List[dict] = []
        self.metrics: dict = {}

    def build_precedence_matrix(self) -> np.ndarray:
        """
        Öncelik ilişkileri matrisini oluşturur (transitive closure dahil).

        matrix[i][j] = 1  →  görev i, görev j'den ÖNCE yapılmalıdır.
        Sütun j'nin toplamı = görev j'nin önkoşul sayısı (kod numarası).
        """
        self.matrix = np.zeros((self.n, self.n), dtype=int)

        # Doğrudan (direct) öncelik ilişkileri
        for pred, succ in self.precedences:
            if pred in self.task_idx and succ in self.task_idx:
                i, j = self.task_idx[pred], self.task_idx[succ]
                self.matrix[i][j] = 1

        # Geçişli kapanış - Warshall algoritması (transitive closure)
        for k in range(self.n):
            for i in range(self.n):
                for j in range(self.n):
                    if self.matrix[i][k] and self.matrix[k][j]:
                        self.matrix[i][j] = 1

        return self.matrix

    def get_precedence_matrix_df(self) -> pd.DataFrame:
        """Öncelik matrisini pandas DataFrame olarak döndürür."""
        if self.matrix is None:
            self.build_precedence_matrix()
        return pd.DataFrame(
            self.matrix,
            index=self.task_names,
            columns=self.task_names
        )

    def solve(self) -> Tuple[List[dict], List[dict]]:
        """
        Hoffman algoritmasını çalıştırır.

        Returns
        -------
        solution_steps : list of dict
            Her adımda yapılan işlemlerin detayları
        stations : list of dict
            İstasyon atamaları
        """
        self.build_precedence_matrix()
        self.solution_steps = []
        self.stations = []

        unassigned = list(self.task_names)
        current_station_tasks: List[str] = []
        remaining_time = self.cycle_time
        station_number = 1
        step_counter = 0

        while unassigned:
            step_counter += 1
            # Safety: prevent infinite loops
            if step_counter > self.n * self.n + self.n + 10:
                break

            # Calculate code numbers (column sums) for unassigned tasks only
            col_sums = {}
            for task in unassigned:
                j = self.task_idx[task]
                # Only count prerequisites that are themselves still unassigned
                code = sum(
                    self.matrix[self.task_idx[t]][j]
                    for t in unassigned
                    if t != task
                )
                col_sums[task] = code

            # Eligible tasks: code number = 0 (no remaining prerequisites)
            eligible = [t for t in unassigned if col_sums[t] == 0]

            # Select the first eligible task that fits within remaining time
            selected = None
            for task in eligible:
                if self.tasks[task] <= remaining_time:
                    selected = task
                    break

            step_info = {
                'step': step_counter,
                'station': station_number,
                'remaining_time_before': remaining_time,
                'col_sums': col_sums.copy(),
                'eligible': eligible.copy(),
                'selected': selected,
                'action': None
            }

            if selected:
                # Assign the task to the current station
                current_station_tasks.append(selected)
                remaining_time -= self.tasks[selected]
                step_info['remaining_time_after'] = remaining_time
                unassigned.remove(selected)
            else:
                # No eligible task fits → close current station, open a new one
                if current_station_tasks:
                    self.stations.append({
                        'station': station_number,
                        'tasks': current_station_tasks.copy(),
                        'time_used': self.cycle_time - remaining_time,
                        'idle_time': remaining_time
                    })
                station_number += 1
                current_station_tasks = []
                remaining_time = self.cycle_time
                step_info['action'] = 'new_station'
                step_info['remaining_time_after'] = remaining_time

                # Edge case: if smallest eligible task > cycle_time, force-assign
                # to prevent infinite loop (the task simply can't fit any station)
                if eligible:
                    smallest = min(eligible, key=lambda t: self.tasks[t])
                    if self.tasks[smallest] > self.cycle_time:
                        current_station_tasks.append(smallest)
                        remaining_time -= self.tasks[smallest]
                        unassigned.remove(smallest)
                        step_info['action'] = 'forced_assignment'
                        step_info['selected'] = smallest
                        step_info['remaining_time_after'] = remaining_time

            self.solution_steps.append(step_info)

        # Add the last station
        if current_station_tasks:
            self.stations.append({
                'station': station_number,
                'tasks': current_station_tasks.copy(),
                'time_used': self.cycle_time - remaining_time,
                'idle_time': max(0, remaining_time)
            })

        self._calculate_metrics()
        return self.solution_steps, self.stations

    def _calculate_metrics(self):
        """Performans metriklerini hesaplar."""
        total_work_time = sum(self.tasks.values())
        num_stations = len(self.stations)

        if num_stations == 0 or self.cycle_time == 0:
            self.metrics = {
                'total_work_time': total_work_time,
                'cycle_time': self.cycle_time,
                'num_stations': 0,
                'theoretical_min': 0,
                'line_efficiency': 0,
                'balance_delay': 100,
                'total_idle_time': 0,
                'idle_times': {}
            }
            return

        theoretical_min = math.ceil(total_work_time / self.cycle_time)
        line_efficiency = (total_work_time / (num_stations * self.cycle_time)) * 100
        balance_delay = 100 - line_efficiency
        idle_times = {f"İstasyon {s['station']}": s['idle_time'] for s in self.stations}
        total_idle = sum(s['idle_time'] for s in self.stations)

        self.metrics = {
            'total_work_time': total_work_time,
            'cycle_time': self.cycle_time,
            'num_stations': num_stations,
            'theoretical_min': theoretical_min,
            'line_efficiency': round(line_efficiency, 2),
            'balance_delay': round(balance_delay, 2),
            'total_idle_time': total_idle,
            'idle_times': idle_times
        }

    def get_metrics(self) -> dict:
        """Performans metriklerini döndürür."""
        return self.metrics

    def validate_inputs(self) -> List[str]:
        """
        Girdileri doğrular. Hata mesajlarının listesini döndürür (boş ise sorun yok).
        """
        errors = []

        if not self.tasks:
            errors.append("En az bir görev tanımlanmalıdır.")

        if self.cycle_time <= 0:
            errors.append("Çevrim süresi pozitif olmalıdır.")

        # Check if precedence references valid tasks
        for pred, succ in self.precedences:
            if pred not in self.tasks:
                errors.append(f"'{pred}' görevi tanımlı değil (öncelik ilişkisinde).")
            if succ not in self.tasks:
                errors.append(f"'{succ}' görevi tanımlı değil (öncelik ilişkisinde).")
            if pred == succ:
                errors.append(f"Bir görev kendisinin önkoşulu olamaz: '{pred}'.")

        # Check for cycles using DFS
        if not errors:
            visited = set()
            rec_stack = set()

            def has_cycle(node):
                visited.add(node)
                rec_stack.add(node)
                for pred, succ in self.precedences:
                    if pred == node:
                        if succ not in visited:
                            if has_cycle(succ):
                                return True
                        elif succ in rec_stack:
                            return True
                rec_stack.discard(node)
                return False

            for task in self.tasks:
                if task not in visited:
                    if has_cycle(task):
                        errors.append("Öncelik ilişkilerinde döngü (cycle) tespit edildi!")
                        break

        return errors
