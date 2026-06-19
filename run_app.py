# run_app.py
# Standalone Launcher for the EliteTutors Application.
# Boots the background database server and triggers the browser window.

import sys
import subprocess
import webbrowser
import time
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_SOCKET, socket.SOCK_STREAM) if hasattr(socket, 'AF_SOCKET') else socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def main():
    print("==================================================")
    print("      EliteTutors Application Launcher            ")
    print("==================================================")
    
    server_port = 5000
    if not is_port_in_use(server_port):
        print("[+] Starting database API server on port 5000...")
        try:
            # Launch server.py in background
            subprocess.Popen([sys.executable, "server.py"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.5) # Give Flask a moment to initialize
        except Exception as e:
            print(f"[-] Error launching database backend: {e}")
            sys.exit(1)
    else:
        print("[*] Database API server is already running on port 5000.")

    app_url = "http://localhost:5000"
    print(f"[+] Launching standalone browser app window pointing to {app_url}...")
    webbrowser.open(app_url)
    
    print("\n[+] EliteTutors is active!")
    print("[*] Note: To install it as a native App on your desktop/phone:")
    print("    Open the URL in Chrome/Edge/Safari, click the '+' or 'Install App' icon in the address bar.")
    print("==================================================")

if __name__ == "__main__":
    main()
