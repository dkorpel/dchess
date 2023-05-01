const fps = 60;
var wasmInstance;

// Graphics
var atlasImage;

// Sound effects
var audioObj;

/// exported so webassembly can send strings to JS
function jsSendString(ptr, len, type) {
	// <textarea>
	//document.getElementById("PGN-input").innerText = toJsString(ptr, len);
	// <input>
	//document.getElementById("FEN-input").value = toJsString(ptr, len);
	const s = toJsString(ptr, len);
	switch (type) {
		case 0:
			console.log(s);
			break;
		case 1:
			document.getElementById("FEN-input").value = s;
			break;
		case 2:
			document.getElementById("PGN-input").value = s;
			//document.getElementById("PGN-input").innerText = s;
			break;
		case 3:
			alert(s);
			break;
		case 4:
			break;
	}
}

function sendFen() {
	wasmSendString(document.getElementById("FEN-input").value, 0);
}

function sendPgn() {
	wasmSendString(document.getElementById("PGN-input").value, 1);
	alert("not implemented yet")
}

function onReset() {
	wasmInstance.exports.hookInitGame();
}

// E.g. 0xAABBCC => "#AABBCC"
function getColorString(color) {
	return "#" + (color >> 0).toString(16).padStart(6, '0');
}

function getAlpha(color) {
	//return (color >> 24) / 255;
	return 1.0;
}

function drawRect(x0, y0, x1, y1, color) {
	const oldAlpha = ctx.globalAlpha;
	//ctx.globalAlpha = getAlpha(color);
	ctx.fillStyle = getColorString(color);
	ctx.fillRect(x0, y0, x1, y1);
	ctx.globalAlpha = oldAlpha;
}

function drawLine(x0, y0, x1, y1, thickness, color) {
	const oldAlpha = ctx.globalAlpha;
	//ctx.globalAlpha = getAlpha(color);
	ctx.strokeStyle = getColorString(color);
	ctx.lineWidth = thickness;
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
	ctx.globalAlpha = oldAlpha;
}

function drawText(x, y, ptr, len, color) {
	const oldAlpha = ctx.globalAlpha;
	//ctx.globalAlpha = getAlpha(color);
	ctx.fillStyle = getColorString(color);
	ctx.textBaseline = "middle";
	ctx.textAlign = "left";
	ctx.fillText(toJsString(ptr, len), x, y);
	ctx.globalAlpha = oldAlpha;
}

function drawCircle(x, y, radius, color) {
	const oldAlpha = ctx.globalAlpha;
	//ctx.globalAlpha = getAlpha(color);
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
	ctx.fillStyle = getColorString(color);
	ctx.fill();
	ctx.globalAlpha = oldAlpha;
}

// (x0, y0) -> (x1, y1) with stem thickness `w` and arrow head width `aw` and height `ah`
function drawArrow(x0, y0, x1, y1, w, aw, ah, color) {
	const oldAlpha = ctx.globalAlpha;
	//ctx.globalAlpha = getAlpha(color);
	ctx.beginPath();
	const dx = (x1 - x0);
	const dy = (y1 - y0)
	const d = Math.sqrt(dx * dx + dy * dy);
	const ux = dx / d;
	const uy = dy / d;
	const xh = x1 - ux * ah;
	const yh = y1 - uy * ah;
	ctx.fillStyle = getColorString(color);
	ctx.moveTo(x0, y0);
	ctx.lineTo(x0 - uy * w, y0 + ux * w);
	ctx.lineTo(xh - uy * w, yh + ux * w);
	ctx.lineTo(xh - uy * aw, yh + ux * aw);
	ctx.lineTo(x1, y1); // tip
	ctx.lineTo(xh + uy * aw, yh - ux * aw);
	ctx.lineTo(xh + uy * w, yh - ux * w);
	ctx.lineTo(x0 + uy * w, y0 - ux * w);
	const a = Math.atan2(ux, -uy);
	ctx.arc(x0, y0, w, a, a + Math.PI, false);
	ctx.fill();
	ctx.globalAlpha = oldAlpha;
}

function drawImage(sx, sy, sw, sh, x, y, w, h) {
	// s = subset of image
	ctx.drawImage(atlasImage, sx, sy, sw, sh, x, y, w, h);
}

// Set alpha of all drawn elements, from 0.0 to 1.0
function setAlpha(alpha) {
	ctx.globalAlpha = alpha;
}

function setFont(size, ptr, len) {
	ctx.font = "" + size + "px " + toJsString(ptr, len);
}

function playSound(s) {
	switch (s) {
		case 0: audioObj.move.play(); break;
		case 1: audioObj.capture.play(); break;
		case 2: audioObj.check.play(); break;
		case 3: audioObj.checkmate.play(); break;
		default: break;
	}
}

function updateSlider(s) {
	wasmInstance.exports.hookDepth(parseInt(s));
	document.getElementById("ai-depth-name").innerText = s;
}

async function initWasm() {
	wasmInstance = await loadWasm('chess.wasm', {
		drawText, drawLine, drawRect, drawCircle, drawImage, drawArrow,
		setAlpha, setFont, jsSendString, playSound,
	});

	atlasImage = new Image();
	atlasImage.src = './chess-piece-face.png';

	audioObj = {
		move: new Audio('./chess-piece.wav'),
		check: new Audio('./chess-check.wav'),
		capture: new Audio('./chess-capture.wav'),
		checkmate: new Audio('./chess-checkmate.wav'),
	}

	createCanvas();
	canvas.addEventListener('mousedown', (evt) => { wasmInstance.exports.hookMouseClick(0, evt.button <= 1 ? 0 : 1); }, false);
	canvas.addEventListener('mouseup', (evt) => { wasmInstance.exports.hookMouseClick(1, evt.button <= 1 ? 0 : 1); }, false);
	canvas.addEventListener('click', () => { wasmInstance.exports.hookMouseClick(2, 0) }, false);
	canvas.addEventListener('dblclick', () => { wasmInstance.exports.hookMouseClick(3, 0) }, false);

	const onKey = (evt, i) => {
		if (evt.keyCode && evt.target.id == "game-canvas") {
			// Give game ability to claim keypresses, to e.g. prevent space bar scrolling
			if (wasmInstance.exports.hookKey(i, evt.keyCode) != 0) {
				evt.preventDefault();
			}
		}
		return false; // don't eat up the key
	}
	window.addEventListener('keydown', (evt) => onKey(evt, 0), false);
	window.addEventListener('keyup', (evt) => onKey(evt, 1), false);

	wasmInstance.exports.hookInitGame();
	canvas.addEventListener('mousemove', (evt) => {
		var rect = canvas.getBoundingClientRect();
		wasmInstance.exports.hookMouseMove(evt.clientX - rect.left, evt.clientY - rect.top);
	}, false);
	wasmInstance.exports.resize(canvas.width, canvas.height);

	document.getElementById("ai-depth").value = "6";
	updateSlider("6");

	setInterval(() => {
		wasmInstance.exports.hookStepGame();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		wasmInstance.exports.hookDrawGame();
	}, /*ms*/ 1000 / fps);

	document.getElementById("maindiv").prepend(canvas);

	document.getElementById('send-fen').addEventListener('onmouseup', sendFen);
	document.getElementById('send-pgn').addEventListener('onmouseup', sendPgn);
	document.getElementById('but-reset').addEventListener('onmouseup', onReset);
	document.getElementById('but-arrows').addEventListener('onchange', (evt) => console.log(evt.target.value));
}

function createCanvas() {
	canvas = document.createElement("canvas");
	canvas.oncontextmenu = () => false; // disable right click on chess board

	function resize(evt) {
		if (window.orientation !== undefined) {
			// mobile device
			canvas.width = document.documentElement.clientWidth;
			canvas.height = document.documentElement.clientHeight - 200;
		} else {
			// desktop device
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight - 200;
		}
	}
	// resize();
	// window.addEventListener('resize', resize, false);
	canvas.width = 768 + 32 + 256; // 800;
	canvas.height = 768;
	ctx = this.canvas.getContext("2d", { alpha: false });
	return canvas;
}

window.addEventListener('load', (event) => { initWasm() });
