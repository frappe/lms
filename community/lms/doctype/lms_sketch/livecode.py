"""Utilities to work with livecode service.
"""
import websocket
import json
from .svg import SVG
import frappe
from urllib.parse import urlparse

# Files to pass to livecode server
# The same code is part of livecode-canvas.js
# TODO: generate livecode-canvas.js from this file
START = '''
import sketch
code = open("main.py").read()
env = dict(sketch.__dict__)
exec(code, env)
'''

SKETCH = '''
import json

def sendmsg(msgtype, function, args):
  """Sends a message to the frontend.

  The frontend will receive the specified message whenever
  this function is called. The frontend can decide to some
  action on each of these messages.
  """
  msg = dict(msgtype=msgtype, function=function, args=args)
  print("--MSG--", json.dumps(msg))

def _draw(func, **kwargs):
  sendmsg(msgtype="draw", function=func, args=kwargs)

def circle(x, y, d):
    """Draws a circle of diameter d with center (x, y).
    """
    _draw("circle", x=x, y=y, d=d)

def line(x1, y1, x2, y2):
    """Draws a line from point (x1, y1) to point (x2, y2).
    """
    _draw("line", x1=x1, y1=y1, x2=x2, y2=y2)

def rect(x, y, w, h):
    """Draws a rectangle on the canvas.

    Parameters
    ----------
    x: x coordinate of the top-left corner of the rectangle
    y: y coordinate of the top-left corner of the rectangle
    w: width of the rectangle
    h: height of the rectangle
    """
    _draw("rect", x=x, y=y, w=w, h=h)

def clear():
    _draw("clear")

# clear the canvas on start
clear()
'''

def get_livecode_url():
    doc = frappe.get_cached_doc("LMS Settings")
    return doc.livecode_url

def get_livecode_ws_url():
    url = urlparse(get_livecode_url())
    protocol = "wss" if url.scheme == "https" else "ws"
    return protocol + "://" + url.netloc + "/livecode"

def livecode_to_svg(livecode_ws_url, code, *, timeout=3):
    """Renders the code as svg.
    """
    if livecode_ws_url is None:
        livecode_ws_url = get_livecode_ws_url()

    try:
        ws = websocket.WebSocket()
        ws.settimeout(timeout)
        ws.connect(livecode_ws_url)

        msg = {
            "msgtype": "exec",
            "runtime": "python",
            "code": code,
            "files": [
                {"filename": "start.py", "contents": START},
                {"filename": "sketch.py", "contents": SKETCH},
            ],
            "command": ["python", "start.py"]
        }
        ws.send(json.dumps(msg))

        messages = _read_messages(ws)
        commands = [m for m in messages if m['msgtype'] == 'draw']
        img = draw_image(commands)
        return img.tostring()
    except websocket.WebSocketException as e:
        frappe.log_error(frappe.get_traceback(), 'livecode_to_svg failed')

def _read_messages(ws):
    messages = []
    try:
        while True:
            msg = ws.recv()
            if not msg:
                break
            messages.append(json.loads(msg))
    except websocket.WebSocketTimeoutException as e:
        print("Error:", e)
        pass
    return messages

def draw_image(commands):
    img = SVG(width=300, height=300, viewBox="0 0 300 300", fill='none', stroke='black')
    for c in commands:
        args = c['args']
        if c['function'] == 'circle':
            img.circle(cx=args['x'], cy=args['y'], r=args['d']/2)
        elif c['function'] == 'line':
            img.line(x1=args['x1'], y1=args['y1'], x2=args['x2'], y2=args['y2'])
        elif c['function'] == 'rect':
            img.rect(x=args['x'], y=args['y'], width=args['w'], height=args['h'])
    return img
