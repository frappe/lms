function getLiveCodeOptions() {
	var START = `
import sketch
code = open("main.py").read()
env = dict(sketch.__dict__)
exec(code, env)
`;

	var SKETCH = `
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
`;
	const CANVAS_FUNCTIONS = {
		circle: function (ctx, args) {
			ctx.beginPath();
			ctx.arc(args.x, args.y, args.d / 2, 0, 2 * Math.PI);
			ctx.stroke();
		},
		line: function (ctx, args) {
			ctx.beginPath();
			ctx.moveTo(args.x1, args.y1);
			ctx.lineTo(args.x2, args.y2);
			ctx.stroke();
		},
		rect: function (ctx, args) {
			ctx.beginPath();
			ctx.rect(args.x, args.y, args.w, args.h);
			ctx.stroke();
		},
		clear: function (ctx, args) {
			var width = 300;
			var height = 300;
			ctx.clearRect(0, 0, width, height);
		},
	};

	function drawOnCanvas(canvasElement, funcName, args) {
		var ctx = canvasElement.getContext("2d");
		var func = CANVAS_FUNCTIONS[funcName];

		var scalex = canvasElement.width / 300;
		var scaley = canvasElement.height / 300;

		ctx.save();
		ctx.scale(scalex, scaley);
		func(ctx, args);
		ctx.restore();
	}

	return {
		runtime: "python",
		files: [
			{ filename: "start.py", contents: START },
			{ filename: "sketch.py", contents: SKETCH },
		],
		command: ["python", "start.py"],
		codemirror: true,
		onMessage: {
			draw: function (editor, msg) {
				const canvasElement = editor.parent.querySelector("canvas");
				drawOnCanvas(canvasElement, msg.function, msg.args);
			},
		},
	};
}
