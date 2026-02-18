import os
import sys

# Add the server directory to sys.path so we can import 'main' and 'app' package
# Vercel places us in /var/task/api usually, or similar
# We need to reach ../server
current_dir = os.path.dirname(__file__)
server_dir = os.path.join(current_dir, '..', 'server')
sys.path.append(server_dir)

from main import app