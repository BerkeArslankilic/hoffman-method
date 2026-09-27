# Hoffman Method - Line Balancing

This is a Python script I wrote for my Computer Integrated Manufacturing (CIM) class. It solves assembly line balancing problems using the Hoffman heuristic method and visualizes the process using Streamlit.

**Live Demo:** [Link](https://hoffman-method-8nkmvbajvdlkk3gwndfca9.streamlit.app/)

## How to run locally
Install the requirements and run the app:
```bash
pip install -r requirements.txt
streamlit run app.py
```
If you are on Windows, you can just run `StartApp.pyw` to open it without a terminal window.

## What it does
- Calculates the precedence matrix (with transitive closure)
- Finds eligible tasks based on code numbers
- Assigns tasks to stations depending on cycle time
- Shows the step-by-step solution
- Gives the final station assignments and efficiency metrics (can be downloaded as a CSV)
