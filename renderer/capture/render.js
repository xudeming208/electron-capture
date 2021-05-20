const {
	ipcRenderer
} = require('electron');

const {
	$,
	currentWidth,
	currentHeight
} = require('./getCurWin');

require('./edit');

const imgDom = $('screenImg');
const canvasDom = $('canvas');
const canvasDomCtx = canvasDom.getContext('2d');
const pointBox = $('pointBox');
const toolbar = $('toolbar');
const coordinate = $('coordinate');
const coordinateInner = $('coordinateInner');
const canvasSize = $('canvasSize');

// 画布历史记录
global.historyArr = [];

// retina显示屏和普通显示屏
const ratio = window.devicePixelRatio || 1;

// toolbar的宽高、canvasSize的宽度
const toolbarWidth = parseFloat(window.getComputedStyle(toolbar, null).minWidth);
const toolbarHeight = parseFloat(window.getComputedStyle(toolbar, null).height);
const canvasSizeHeight = parseFloat(window.getComputedStyle(canvasSize, null).height);

// drag
let canDrag = false;
let originX = 0;
let originY = 0;
let canvasWidth = 0;
let canvasHeight = 0;

// move
let canMove = false;
let moveStartX = 0;
let moveStartY = 0;

// resize
let canResize = false;
let resizeId = '';
let resizeX = 0;
let resizeY = 0;
let resizeW = 0;
let resizeH = 0;

// 获取canvas的宽高
const getCanvasWH = () => {
	let style = canvasDom.style || {};
	let x = parseInt(style.left);
	let y = parseInt(style.top);
	let w = parseInt(style.width);
	let h = parseInt(style.height);
	return {
		x,
		y,
		w,
		h
	};
}

// 设置8个编辑点及操作按钮
const setPoints = () => {
	let {
		x,
		y,
		w,
		h
	} = getCanvasWH();

	if (w || h) {
		pointBox.style.cssText += 'width: ' + w + 'px; height: ' + h + 'px; left: ' + x + 'px; top: ' + y + 'px; display: block;';

		// 截完图后编辑按钮样式
		let style = toolbar.style;
		style.cssText += 'left: ' + (x + w) + 'px; top: ' + (y + h) + 'px; bottom: auto; display: block;';

		// 边界控制
		if (y <= canvasSizeHeight) {
			canvasSize.style.cssText += 'left: ' + (x + 3) + 'px; top: ' + (y + 3) + 'px';
		}


		if (parseInt(style.top) >= currentHeight - toolbarHeight - 100) {
			style.cssText += 'top: auto; bottom: ' + (currentHeight - y + 10) + 'px';
		}
		if (canvasWidth <= toolbarWidth && x <= toolbarWidth) {
			style.cssText += 'left: ' + toolbarWidth + 'px;';
		}
		if (y <= toolbarHeight && canvasHeight >= currentHeight - toolbarHeight - 100) {
			style.cssText += 'bottom: auto; left: ' + (x + w - 3)  + 'px; top: ' + (y + 3) + 'px';
		}
	}
}

// 边界控制
let limit = (l, t, w, h) => {
	if (l <= 0) {
		l = 0;
	}
	if (t <= 0) {
		t = 0;
	}
	if (t >= currentHeight - h) {
		t = currentHeight - h;
	}

	if (l >= currentWidth - w) {
		l = currentWidth - w;
	}

	return {
		left: l,
		top: t
	};
}

// mousedownFun
global.mousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	originX = e.clientX;
	originY = e.clientY;

	// 避免多个屏幕可以截图多个。当一个屏蔽截图后，另一个屏幕不能截屏
	if (!+localStorage.hasDrag) {
		canDrag = true;
		return;
	}


	let targetDom = e.target;
	let targetDomId = targetDom.id;
	// 移动canvas
	if (targetDomId == 'pointBox') {
		canMove = true;
		let style = canvasDom.style;
		moveStartX = originX - parseInt(style.left);
		moveStartY = originY - parseInt(style.top);
		return;
	}

	// resize canvas
	if (~['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].indexOf(targetDomId)) {
		canResize = true;
		resizeId = targetDomId;
		resizeX = getCanvasWH().x;
		resizeY = getCanvasWH().y;
		resizeW = getCanvasWH().w;
		resizeH = getCanvasWH().h;
	}
}

// mousemoveFun
global.mousemoveFun = e => {
	e.stopPropagation();
	e.preventDefault();

	let nowX = e.clientX;
	let nowY = e.clientY;

	// 边界控制，不允许从一个屏幕滑到另一个屏幕
	if(nowX >= currentWidth) {
		nowX = currentWidth;
	}
	if(nowY >= currentHeight) {
		nowY = currentHeight;
	}

	// 光标
	// if (!canvasWidth) {
	// 	coordinate.style.cssText += 'left: ' + (nowX + 10) + 'px; top: ' + (nowY + 10) + 'px;';
	// 	coordinateInner.innerText = 'X:' + nowX + ', Y:' + nowY;
	// }

	// 移动canvas
	if (canMove) {
		let left = nowX - moveStartX;
		let top = nowY - moveStartY;

		// 边界控制
		left = limit(left, top, canvasWidth, canvasHeight).left;
		top = limit(left, top, canvasWidth, canvasHeight).top;

		canvasDom.style.cssText += 'left: ' + left + 'px; top: ' + top + 'px;';
		pointBox.style.cssText += 'left: ' + left + 'px; top: ' + top + 'px;';

		canvasSize.style.cssText += 'left: ' + left + 'px; top: ' + (top - 30) + 'px;';

		toolbar.style.display = 'none';
		canvasDomCtx.drawImage(imgDom, -left * ratio, -top * ratio);
		return;
	}

	let left = 0;
	let top = 0;
	let newW = 0;
	let newH = 0;
	// resize canvas
	if (canResize) {
		switch (resizeId) {
			case 'p1':
				left = nowX;
				top = nowY;
				newW = Math.abs(left - (resizeX + resizeW));
				newH = Math.abs(top - (resizeY + resizeH));

				// 当往右或者往下拉取的坐标大于原宽度和高度时
				if (nowX > resizeX + resizeW) {
					left = resizeX + resizeW;
					newW = Math.abs(nowX - left);
				}
				if (nowY > resizeY + resizeH) {
					top = resizeY + resizeH;
					newH = Math.abs(nowY - top);
				}
				break;
			case 'p2':
				left = resizeX;
				top = nowY;
				newW = canvasWidth;
				newH = Math.abs(top - (resizeY + resizeH));

				if (nowY > resizeY + resizeH) {
					top = resizeY + resizeH;
					newH = Math.abs(nowY - top);
				}
				break;
			case 'p3':
				left = resizeX;
				top = nowY;
				newW = Math.abs(nowX - left);
				newH = Math.abs(top - (resizeY + resizeH));

				if (nowX < resizeX) {
					left = nowX;
					newW = Math.abs(resizeX - left);
				}
				if (nowY > resizeY + resizeH) {
					top = resizeY + resizeH;
					newH = Math.abs(nowY - top);
				}
				break;
			case 'p4':
				left = nowX;
				top = resizeY;
				newW = Math.abs(left - (resizeX + resizeW));
				newH = canvasHeight;

				if (nowX > resizeX + resizeW) {
					left = resizeX + resizeW;
					newW = Math.abs(nowX - left);
				}
				break;
			case 'p5':
				left = resizeX;
				top = resizeY;
				newW = Math.abs(nowX - left);
				newH = canvasHeight;

				if (nowX < resizeX) {
					left = nowX;
					newW = Math.abs(resizeX - left);
				}
				break;
			case 'p6':
				left = nowX;
				top = resizeY;
				newW = Math.abs(left - (resizeX + resizeW));
				newH = Math.abs(nowY - top);

				if (nowX > resizeX + resizeW) {
					left = resizeX + resizeW;
					newW = Math.abs(nowX - left);
				}
				if (nowY < resizeY) {
					top = nowY;
					newH = Math.abs(resizeY - top);
				}
				break;
			case 'p7':
				left = resizeX;
				top = resizeY;
				newW = canvasWidth;
				newH = Math.abs(nowY - top);

				if (nowY < resizeY) {
					top = nowY;
					newH = Math.abs(resizeY - top);
				}
				break;
			case 'p8':
				left = resizeX;
				top = resizeY;
				newW = Math.abs(nowX - left);
				newH = Math.abs(nowY - top);

				if (nowX < resizeX) {
					left = nowX;
					newW = Math.abs(resizeX - left);
				}
				if (nowY < resizeY) {
					top = nowY;
					newH = Math.abs(resizeY - top);
				}
				break;
		}

		canvasWidth = newW;
		canvasHeight = newH;
	}

	// 截图
	if (canDrag) {
		left = originX;
		top = originY;

		// 适应“由下往上画”或者“由右往左画”
		if (nowX < originX) {
			left = nowX;
		}
		if (nowY < originY) {
			top = nowY;
		}

		canvasWidth = Math.abs(nowX - originX);
		canvasHeight = Math.abs(nowY - originY);

		// coordinate.style.cssText += 'left: -1000px;top:-1000px';
	}

	// resize和drag共同的部分
	if (canResize || canDrag) {

		// 边界控制
		left = limit(left, top, canvasWidth, canvasHeight).left;
		top = limit(left, top, canvasWidth, canvasHeight).top;


		pointBox.style.cssText += 'width: ' + canvasWidth + 'px; height: ' + canvasHeight + 'px; left: ' + left + 'px; top: ' + top + 'px;';
		canvasSize.innerText = canvasWidth + ' * ' + canvasHeight;
		canvasSize.style.cssText += 'left: ' + left + 'px; top: ' + (top - 30) + 'px;';

		canvasDom.width = canvasWidth * ratio;
		canvasDom.height = canvasHeight * ratio;
		canvasDom.style.cssText += 'width: ' + canvasWidth + 'px; height: ' + canvasHeight + 'px; left: ' + left + 'px; top: ' + top + 'px; display: block;';
		canvasDomCtx.drawImage(imgDom, -left * ratio, -top * ratio);
	}
}

// mouseupFun
global.mouseupFun = e => {
	e.stopPropagation();
	e.preventDefault();
	canDrag = false;
	canMove = false;
	canResize = false;
	setPoints();
	toolbar.style.display = 'block';

	if (canvasWidth || canvasHeight) {
		localStorage.hasDrag = 1;

		// 这里将base64存储在localStorage中，主要是避免在一个屏幕截图，在另一个屏幕双击拷贝到剪切板中，截图为空白的bug。
		// bug的原因：多个屏幕的document为相互独立的（因为主进程中用的map，每个window都载入页面），在没有截图的屏幕双击拷贝的是当前屏幕的document的canvas，而不是截图的屏幕的document的canvas
		let cutImgUrl = canvasDom.toDataURL();
		localStorage.cutImgUrl = cutImgUrl;

		// 将画布存入缓存，用于将来撤销上一步操作
		global.historyArr[0] = cutImgUrl;
	}
}

// 截图
function init() {
	ipcRenderer.on('capture-finish', () => {
		localStorage.hasDrag = 0;
	});


	document.addEventListener('mousedown', mousedownFun, false);
	document.addEventListener('mousemove', mousemoveFun, false);
	document.addEventListener('mouseup', mouseupFun, false);
}

exports.cut = init;