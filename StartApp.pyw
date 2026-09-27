import subprocess
import tkinter as tk
import threading
import sys
import os

def start_server():
    global process
    process = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", "app.py"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        creationflags=subprocess.CREATE_NO_WINDOW
    )

def stop_server():
    try:
        process.terminate()
    except:
        pass
    root.destroy()

root = tk.Tk()
root.title("Hoffman Solver")
root.geometry("300x120")
root.resizable(False, False)
root.eval('tk::PlaceWindow . center')
root.attributes('-topmost', True)

tk.Label(
    root, 
    text="Application is starting in your browser...\nKeep this window open to run the server.", 
    font=("Arial", 10),
    pady=15
).pack()

tk.Button(
    root, 
    text="Close Application", 
    command=stop_server, 
    font=("Arial", 10)
).pack()

root.protocol("WM_DELETE_WINDOW", stop_server)
threading.Thread(target=start_server, daemon=True).start()
root.mainloop()
