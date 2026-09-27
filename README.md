# Hoffman Method for Assembly Line Balancing

A Python tool built with Streamlit to solve assembly line balancing problems using the Hoffman heuristic. This was developed as a project for my Computer Integrated Manufacturing (CIM) class.

## Features

🚀 **Live Demo:** [Play with the app here!](https://hoffman-method-8nkmvbajvdlkk3gwndfca9.streamlit.app/)

- Takes task times, precedence constraints, and cycle time as inputs.
- Automatically generates the precedence matrix (including transitive closures).
- Solves the line balancing problem step by step.
- Displays the precedence diagram using NetworkX.
- Exports the final station assignments to a CSV file.

## Installation and Usage

1. Clone the repository:
```bash
git clone https://github.com/BerkeArslankilic/hoffman-method.git
cd hoffman-method
```

2. Install the required libraries:
```bash
pip install -r requirements.txt
```

3. Run the application:
If you are on Windows, you can simply double-click the `StartApp.pyw` file to run it without a terminal window. 

Alternatively, you can run it from the command line:
```bash
streamlit run app.py
```

## License
MIT License
