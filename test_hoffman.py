from hoffman import HoffmanSolver

tasks = {"A": 3, "B": 6, "C": 4, "D": 5, "E": 3, "F": 2, "G": 5, "H": 4}
prec = [("A","B"),("A","C"),("B","D"),("C","D"),("C","E"),("D","F"),("E","F"),("F","G"),("G","H")]

solver = HoffmanSolver(tasks, prec, 12)
errors = solver.validate_inputs()
print("Validation:", errors if errors else "OK")

steps, stations = solver.solve()
metrics = solver.get_metrics()

print()
print("=== ISTASYON ATAMALARI ===")
for s in stations:
    t = s["tasks"]
    tu = s["time_used"]
    it = s["idle_time"]
    print(f"Istasyon {s['station']}: {t} | Sure: {tu} | Bos: {it}")

print()
print("=== PERFORMANS ===")
for k, v in metrics.items():
    if k != "idle_times":
        print(f"  {k}: {v}")

print()
print("=== ONCELIK MATRISI ===")
print(solver.get_precedence_matrix_df())
