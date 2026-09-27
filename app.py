"""
Hoffman Method - Assembly Line Balancing Solver
"""

import streamlit as st
import pandas as pd
import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib
from hoffman import HoffmanSolver

matplotlib.rcParams['font.family'] = 'DejaVu Sans'

st.set_page_config(
    page_title="Hoffman Method Solver",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("Hoffman Method - Assembly Line Balancing")
st.caption("A heuristic solver for assembly line balancing problems.")

if 'loaded_example' not in st.session_state:
    st.session_state.loaded_example = False
if 'solved' not in st.session_state:
    st.session_state.solved = False

# Sidebar Inputs
st.sidebar.header("Input Parameters")

if st.sidebar.button("Load Example Data", use_container_width=True):
    st.session_state.loaded_example = True
    st.session_state.solved = False
    st.rerun()

st.sidebar.divider()

if st.session_state.loaded_example:
    default_num = 8
    default_names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    default_times = [3, 6, 4, 5, 3, 2, 5, 4]
    default_prec = "A,B\nA,C\nB,D\nC,D\nC,E\nD,F\nE,F\nF,G\nG,H"
    default_cycle = 12.0
else:
    default_num = 3
    default_names = ['A', 'B', 'C']
    default_times = [3, 5, 4]
    default_prec = "A,B\nA,C"
    default_cycle = 10.0

num_tasks = st.sidebar.number_input("Number of Tasks", min_value=2, max_value=30, value=default_num)

st.sidebar.subheader("Task Times")
task_names = []
task_times = []
for i in range(num_tasks):
    cols = st.sidebar.columns([1, 2])
    default_name = default_names[i] if i < len(default_names) else f"T{i+1}"
    default_time = float(default_times[i]) if i < len(default_times) else 1.0
    name = cols[0].text_input(f"Name", value=default_name, key=f"name_{i}", label_visibility="collapsed")
    time = cols[1].number_input(f"Time", min_value=0.1, value=default_time, step=0.5, key=f"time_{i}", label_visibility="collapsed")
    task_names.append(name.strip())
    task_times.append(time)

tasks = {name: time for name, time in zip(task_names, task_times) if name}

st.sidebar.subheader("Precedence Relationships")
st.sidebar.caption("Format: Predecessor,Successor (one per line)")
pred_text = st.sidebar.text_area(
    "Precedences",
    value=default_prec,
    height=150,
    label_visibility="collapsed"
)

precedences = []
if pred_text.strip():
    for line in pred_text.strip().split('\n'):
        if ',' in line:
            parts = line.split(',')
            if len(parts) >= 2:
                u, v = parts[0].strip(), parts[1].strip()
                if u and v:
                    precedences.append((u, v))

st.sidebar.divider()
cycle_time = st.sidebar.number_input("Cycle Time (C)", min_value=0.1, value=default_cycle, step=1.0)

st.sidebar.divider()
solve_clicked = st.sidebar.button("Solve", use_container_width=True, type="primary")

if solve_clicked:
    solver = HoffmanSolver(tasks, precedences, cycle_time)
    errors = solver.validate_inputs()
    
    if errors:
        for err in errors:
            st.error(f"Error: {err}")
        st.stop()

    steps, stations = solver.solve()
    metrics = solver.get_metrics()

    col_diagram, col_matrix = st.columns([1, 1])

    with col_diagram:
        st.subheader("Precedence Diagram")
        G = nx.DiGraph()
        for t, d in tasks.items():
            G.add_node(t)
        G.add_edges_from(precedences)

        fig1, ax1 = plt.subplots(figsize=(8, 5))
        try:
            topo_order = list(nx.topological_sort(G))
            layers = {}
            for node in topo_order:
                preds_layers = [layers[p] for p in G.predecessors(node) if p in layers]
                layers[node] = (max(preds_layers) + 1) if preds_layers else 0

            layer_groups = {}
            for node, layer in layers.items():
                layer_groups.setdefault(layer, []).append(node)

            pos = {}
            max_layer = max(layers.values()) if layers else 0
            for layer, nodes in layer_groups.items():
                count = len(nodes)
                for idx, node in enumerate(nodes):
                    x = layer / max(max_layer, 1)
                    y = (idx - (count - 1) / 2) * 0.3
                    pos[node] = (x, y)
        except nx.NetworkXUnfeasible:
            pos = nx.spring_layout(G, seed=42)

        labels = {t: f"{t}\n({tasks[t]})" for t in G.nodes()}
        nx.draw_networkx_nodes(G, pos, ax=ax1, node_color='lightblue', node_size=2000, alpha=0.9)
        nx.draw_networkx_labels(G, pos, ax=ax1, labels=labels, font_size=10, font_weight='bold')
        nx.draw_networkx_edges(G, pos, ax=ax1, edge_color='gray', arrows=True, arrowsize=20, arrowstyle='-|>', connectionstyle='arc3,rad=0.1')
        ax1.axis('off')
        st.pyplot(fig1)
        plt.close(fig1)

    with col_matrix:
        st.subheader("Precedence Matrix")
        df_matrix = solver.get_precedence_matrix_df()
        code_nums = df_matrix.sum(axis=0)
        df_display = pd.concat([df_matrix, pd.DataFrame([code_nums], index=["Code Number"], columns=df_matrix.columns)])
        
        def highlight_matrix(val):
            return 'background-color: lightblue' if val == 1 else ''

        st.dataframe(df_display.style.map(highlight_matrix), use_container_width=True)
        st.caption("Tasks with a Code Number of 0 are eligible for assignment.")

    st.divider()

    st.subheader("Step by Step Solution")
    for step in steps:
        if step['action'] == 'new_station':
            st.info(f"Station {step['station'] - 1} closed. Opened Station {step['station']}.")
            continue

        selected = step['selected']
        station = step['station']
        eligible = step['eligible']

        with st.expander(f"Step {step['step']} - Station {station} | Selected: {selected} | Remaining Time: {step.get('remaining_time_after', '?')}", expanded=False):
            c1, c2 = st.columns([2, 1])
            with c1:
                sums = step['col_sums']
                df_sums = pd.DataFrame({
                    'Task': list(sums.keys()),
                    'Code No': list(sums.values()),
                    'Time': [tasks[t] for t in sums.keys()],
                    'Status': ['Assigned' if t == selected else ('Eligible' if t in eligible else 'Waiting') for t in sums.keys()]
                })
                st.dataframe(df_sums, use_container_width=True, hide_index=True)

            with c2:
                st.write(f"**Current Station:** {station}")
                st.write(f"**Time Before:** {step['remaining_time_before']}")
                if selected:
                    st.write(f"**Time After:** {step['remaining_time_after']}")

    st.divider()

    col_stations, col_metrics = st.columns([1, 1])
    with col_stations:
        st.subheader("Station Assignments")
        station_data = []
        for s in stations:
            station_data.append({
                'Station': s['station'],
                'Tasks': ", ".join(s['tasks']),
                'Used Time': s['time_used'],
                'Idle Time': s['idle_time'],
                'Efficiency (%)': round((s['time_used'] / cycle_time) * 100, 1)
            })
        df_stations = pd.DataFrame(station_data)
        st.dataframe(df_stations, use_container_width=True, hide_index=True)

        csv = df_stations.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="Download CSV",
            data=csv,
            file_name='station_assignments.csv',
            mime='text/csv',
        )

    with col_metrics:
        st.subheader("Performance Metrics")
        st.write(f"**Total Work Time:** {metrics['total_work_time']}")
        st.write(f"**Cycle Time:** {metrics['cycle_time']}")
        st.write(f"**Number of Stations:** {metrics['num_stations']}")
        st.write(f"**Theoretical Minimum:** {metrics['theoretical_min']}")
        st.write(f"**Line Efficiency:** {metrics['line_efficiency']}%")
        st.write(f"**Balance Delay:** {metrics['balance_delay']}%")
        st.write(f"**Total Idle Time:** {metrics['total_idle_time']}")

    st.divider()

    st.subheader("Station Load Distribution")
    fig2, ax2 = plt.subplots(figsize=(10, 4))
    station_labels = [f"St. {s['station']}" for s in stations]
    used = [s['time_used'] for s in stations]
    idle = [s['idle_time'] for s in stations]

    ax2.bar(station_labels, used, label='Used Time', color='steelblue')
    ax2.bar(station_labels, idle, bottom=used, label='Idle Time', color='lightgray')
    ax2.axhline(y=cycle_time, color='red', linestyle='--', label='Cycle Time')

    ax2.set_ylabel('Time')
    ax2.set_xlabel('Stations')
    ax2.legend()
    st.pyplot(fig2)
    plt.close(fig2)

else:
    st.info("Please enter the task data on the left panel or click 'Load Example Data' to begin.")

st.sidebar.divider()
st.sidebar.markdown(
    "<div style='text-align: center; color: gray; font-size: 0.8rem;'>"
    "Hoffman Solver v1.0<br>"
    "Developed for CIM"
    "</div>", 
    unsafe_allow_html=True
)
