const {
	ipcRenderer,
	clipboard,
	nativeImage,
	remote
} = require('electron');

const {
	$
} = require('./getCurWin');

const fs = require('fs');

const islinux = process.platform == 'linux';

// retina显示屏和普通显示屏
const ratio = window.devicePixelRatio || 1;

const canvasDom = $('canvas');
const canvasDomCtx = canvasDom.getContext('2d');
const pointBox = $('pointBox');

// 保存截图
const saveCanvas = () => {
	// 这里将base64存储在localStorage中，主要是避免在一个屏幕截图，在另一个屏幕双击拷贝到剪切板中，截图为空白的bug。
	// bug的原因：多个屏幕的document为相互独立的（因为主进程中用的map，每个window都载入页面），在没有截图的屏幕双击拷贝的是当前屏幕的document的canvas，而不是截图的屏幕的document的canvas
	let cutImgUrl = canvasDom.toDataURL();
	localStorage.cutImgUrl = cutImgUrl;

	// 将历史存储在内存中
	global.historyArr.push(cutImgUrl);
	undo.classList.remove('undo-disabled');
}

// 获取canvas的宽高和坐标
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

// 截图像素数据
let drawingSurfacsImageData = '';
//保存当前的canvas上的数据
const saveDrawingSurface = () => {
	drawingSurfacsImageData = canvasDomCtx.getImageData(0, 0, getCanvasWH().w * ratio, getCanvasWH().h * ratio);
}
//恢复canvas的数据，主要用来显示最新的线段，擦除原来的线段
const restoreDrawingSurface = () => {
	canvasDomCtx.putImageData(drawingSurfacsImageData, 0, 0, 0, 0, getCanvasWH().w * ratio, getCanvasWH().h * ratio);
}


// 移除所有的事件
const removeAllListener = () => {
	document.removeEventListener('mousedown', mousedownFun);
	document.removeEventListener('mousemove', mousemoveFun);
	document.removeEventListener('mouseup', mouseupFun);

	pointBox.removeEventListener('mousedown', rectMousedownFun);
	pointBox.removeEventListener('mousemove', rectMousemoveFun);
	pointBox.removeEventListener('mouseup', rectMouseupFun);

	pointBox.removeEventListener('mousedown', circleMousedownFun);
	pointBox.removeEventListener('mousemove', circleMousemoveFun);
	pointBox.removeEventListener('mouseup', circleMouseupFun);

	pointBox.removeEventListener('mousedown', arrowMousedownFun);
	pointBox.removeEventListener('mousemove', arrowMousemoveFun);
	pointBox.removeEventListener('mouseup', arrowMouseupFun);

	pointBox.removeEventListener('mousedown', graffitiMousedownFun);
	pointBox.removeEventListener('mousemove', graffitiMousemoveFun);
	pointBox.removeEventListener('mouseup', graffitiMouseupFun);

	// 切换工具时，将之前的文字画入，并删除之前的dom
	if (textConfig.dom) {
		saveFocusText();
	}

	pointBox.removeEventListener('mousedown', textMousedownFun);
	pointBox.removeEventListener('mousemove', textMousemoveFun);
	pointBox.removeEventListener('mouseup', textMouseupFun);
}

// 移除所有的active样式
const removeActiveClass = () => {
	rect.classList.remove('rect-active');
	circle.classList.remove('circle-active');
	arrow.classList.remove('arrow-active');
	graffiti.classList.remove('graffiti-active');
	text.classList.remove('text-active');
}



// 输入文本还没失去焦点时，就执行其他动作，此时将文本也画入画布
const saveFocusText = () => {
	// canvasDomCtx.fillText(textConfig.dom.innerText || '', textConfig.originX, textConfig.originY);
	// 考虑文本换行的情况
	let arr = textConfig.dom.innerText ? textConfig.dom.innerText.split('\n') : [];
	arr.forEach((item, index) => {
		canvasDomCtx.fillText(item, textConfig.originX, textConfig.originY + index * toolConfigObj.text.fontSize * ratio);
	});

	document.body.removeChild(textConfig.dom);
	textConfig.dom = '';

	saveCanvas();
}



// 大小和颜色选择开始
const toolCofig = $('toolCofig');
const iconArrow = $('iconArrow');
const domSize = document.querySelectorAll('.size');
const domColor = document.querySelectorAll('.color');
let curTool = 'rect';
// 保存配置大小和颜色的对象.避免每次切换工具都重置大小和颜色。下面的值都是默认值
let toolConfigObj = {
	rect: {
		lineWidth: 2 * ratio,
		strokeStyle: '#f00',
		sizeIndex: 0,
		colorIndex: 0,
	},
	circle: {
		lineWidth: 2 * ratio,
		strokeStyle: '#f00',
		sizeIndex: 0,
		colorIndex: 0,
	},
	arrow: {
		lineWidth: 2 * ratio,
		strokeStyle: '#f00',
		sizeIndex: 0,
		colorIndex: 0,
	},
	graffiti: {
		lineWidth: 2 * ratio,
		strokeStyle: '#f00',
		sizeIndex: 0,
		colorIndex: 0,
	},
	text: {
		fontSize: 16,
		fillStyle: '#f00',
		sizeIndex: 0,
		colorIndex: 0,
	},
}

// 如果选中了“是否保存截图工具的大小和颜色选择”，则获取localstorage中的配置，否则用默认值
if (+localStorage.toolInput && localStorage.toolConfigObj) {
	toolConfigObj = JSON.parse(localStorage.toolConfigObj);
}

// 重置大小、颜色的cur
const resetSizeColorCur = (isSize, isColor) => {
	if (isSize) {
		for (let i = 0, len = domSize.length; i < len; i++) {
			domSize[i].classList.remove('size-cur');
		}
	}
	if (isColor) {
		for (let i = 0, len = domColor.length; i < len; i++) {
			domColor[i].classList.remove('color-cur');
		}
	}
}
const sizeColorChange = type => {
	toolCofig.style.display = 'inline-block';

	resetSizeColorCur(true, true);

	switch (type) {
		case 'rect':
			iconArrow.style.left = '10px';
			curTool = 'rect';
			break;
		case 'circle':
			iconArrow.style.left = '45px';
			curTool = 'circle';
			break;
		case 'arrow':
			iconArrow.style.left = '80px';
			curTool = 'arrow';
			// 箭头的填充色和边框色一样
			canvasDomCtx.fillStyle = toolConfigObj.arrow.strokeStyle;
			break;
		case 'graffiti':
			iconArrow.style.left = '115px';
			curTool = 'graffiti';
			break;
		case 'text':
			iconArrow.style.left = '151px';
			curTool = 'text';
			domSize[toolConfigObj.text.sizeIndex].classList.add('size-cur');
			domColor[toolConfigObj.text.colorIndex].classList.add('color-cur');
			canvasDomCtx.font = '' + toolConfigObj.text.fontSize * ratio + 'px "微软雅黑"';
			canvasDomCtx.fillStyle = toolConfigObj.text.fillStyle;
			break;
	}

	// 共同的部分
	if (['rect', 'circle', 'arrow', 'graffiti'].includes(curTool)) {
		domSize[toolConfigObj[curTool].sizeIndex].classList.add('size-cur');
		domColor[toolConfigObj[curTool].colorIndex].classList.add('color-cur');
		canvasDomCtx.lineWidth = toolConfigObj[curTool].lineWidth;
		canvasDomCtx.strokeStyle = toolConfigObj[curTool].strokeStyle;
	}
}
// 工具点击事件
toolCofig.addEventListener('click', e => {
	let target = e.target;

	// 大小设置
	if (target.dataset.size) {
		resetSizeColorCur(true, false);
		target.classList.add('size-cur');

		toolConfigObj[curTool].lineWidth = +target.dataset.size * ratio;
		toolConfigObj[curTool].sizeIndex = +target.dataset.index;

		// 文字时:
		if (['text'].includes(curTool)) {
			toolConfigObj[curTool].fontSize = +target.dataset.size * 8;
		}
	}

	// 颜色设置
	if (target.dataset.color) {
		resetSizeColorCur(false, true);
		target.classList.add('color-cur');

		toolConfigObj[curTool].strokeStyle = target.dataset.color;
		toolConfigObj[curTool].colorIndex = +target.dataset.index;

		// 文字时:
		if (['text'].includes(curTool)) {
			toolConfigObj[curTool].fillStyle = target.dataset.color;
		}
	}

	// 改变大小和颜色后，要实时改变canvasDomCtx的配置，才能生效
	sizeColorChange(curTool);

	// 将配置保存到localstorage中
	if (+localStorage.toolInput) {
		localStorage.toolConfigObj = JSON.stringify(toolConfigObj);
	}
}, false);
// 大小和颜色选择结束



// 矩形
let rectConfig = {
	canDrag: false,
	originX: 0,
	originY: 0
}
// rectMousedownFun
const rectMousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	saveDrawingSurface();

	rectConfig.originX = e.clientX;
	rectConfig.originY = e.clientY;
	rectConfig.canDrag = true;
}
// rectMousemoveFun
const rectMousemoveFun = e => {
	e.stopPropagation();
	e.preventDefault();

	if (rectConfig.canDrag) {
		restoreDrawingSurface();

		let nowX = e.clientX;
		let nowY = e.clientY;
		let x = (rectConfig.originX - getCanvasWH().x) * ratio;
		let y = (rectConfig.originY - getCanvasWH().y) * ratio;

		// 适应“由下往上画”或者“由右往左画”
		if (nowX < rectConfig.originX) {
			x = (nowX - getCanvasWH().x) * ratio;
		}
		if (nowY < rectConfig.originY) {
			y = (nowY - getCanvasWH().y) * ratio;
		}

		let width = Math.abs(nowX - rectConfig.originX);
		let height = Math.abs(nowY - rectConfig.originY);

		canvasDomCtx.beginPath();
		canvasDomCtx.rect(x, y, width * ratio, height * ratio);
		canvasDomCtx.stroke();
	}
}
// rectMouseupFun
const rectMouseupFun = e => {
	e.stopPropagation();
	e.preventDefault();

	rectConfig.canDrag = false;
	saveCanvas();
}
// 矩形
const rect = $('rect');
rect.addEventListener('click', e => {
	removeAllListener();
	removeActiveClass();

	sizeColorChange('rect');

	pointBox.style.cursor = 'crosshair';
	rect.classList.add('rect-active');

	pointBox.addEventListener('mousedown', rectMousedownFun, false);
	pointBox.addEventListener('mousemove', rectMousemoveFun, false);
	pointBox.addEventListener('mouseup', rectMouseupFun, false);
}, false);



// 椭圆
let circleConfig = {
	canDrag: false,
	originX: 0,
	originY: 0
}
// circleMousedownFun
const circleMousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	circleConfig.originX = e.clientX;
	circleConfig.originY = e.clientY;

	saveDrawingSurface();
	circleConfig.canDrag = true;
}
// circleMousemoveFun
const circleMousemoveFun = e => {
	e.stopPropagation();
	e.preventDefault();

	if (circleConfig.canDrag) {
		restoreDrawingSurface();

		let nowX = e.clientX;
		let nowY = e.clientY;
		let radiusX = Math.abs((nowX - circleConfig.originX) / 2);
		let radiusY = Math.abs((nowY - circleConfig.originY) / 2);
		let x = radiusX + circleConfig.originX - getCanvasWH().x;
		let y = radiusY + circleConfig.originY - getCanvasWH().y;

		// 向左画
		if (nowX < circleConfig.originX) {
			x = radiusX + nowX - getCanvasWH().x;
		}

		// 向上画
		if (nowY < circleConfig.originY) {
			y = radiusY + nowY - getCanvasWH().y;
		}

		canvasDomCtx.beginPath();
		canvasDomCtx.ellipse(x * ratio, y * ratio, radiusX * ratio, radiusY * ratio, 0 * Math.PI / 180, 0, 2 * Math.PI);
		canvasDomCtx.stroke();
	}
}
// circleMouseupFun
const circleMouseupFun = e => {
	e.stopPropagation();
	e.preventDefault();
	circleConfig.canDrag = false;
	saveCanvas();
}
// 椭圆
const circle = $('circle');
circle.addEventListener('click', e => {
	removeAllListener();
	removeActiveClass();

	sizeColorChange('circle');

	pointBox.style.cursor = 'crosshair';
	circle.classList.add('circle-active');

	pointBox.addEventListener('mousedown', circleMousedownFun, false);
	pointBox.addEventListener('mousemove', circleMousemoveFun, false);
	pointBox.addEventListener('mouseup', circleMouseupFun, false);
}, false);



// 箭头
let arrowConfig = {
	// 箭头大小
	size: 10,
	canDrag: false,
	originX: 0,
	originY: 0
};

// arrowMousedownFun
const arrowMousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	arrowConfig.originX = e.clientX;
	arrowConfig.originY = e.clientY;

	// 保存截图数据	
	saveDrawingSurface();
	arrowConfig.canDrag = true;
}
// arrowMousemoveFun
const arrowMousemoveFun = e => {
	e.stopPropagation();
	e.preventDefault();

	if (arrowConfig.canDrag) {

		// 恢复canvas的数据
		restoreDrawingSurface();

		// 画线
		canvasDomCtx.beginPath();
		canvasDomCtx.moveTo((arrowConfig.originX - getCanvasWH().x) * ratio, (arrowConfig.originY - getCanvasWH().y) * ratio);
		canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio);
		canvasDomCtx.stroke();

		// 画箭头(横向)
		// canvasDomCtx.beginPath();
		// canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio - arrowConfig.size);
		// canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio + arrowConfig.size * 2, (e.clientY - getCanvasWH().y) * ratio);
		// canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio + arrowConfig.size);
		// canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio - arrowConfig.size);
		// canvasDomCtx.fill();
		// canvasDomCtx.stroke();

		// 起点
		let moveX = (arrowConfig.originX - getCanvasWH().x) * ratio;
		let moveY = (arrowConfig.originY - getCanvasWH().y) * ratio;
		// 终点
		let lineX = (e.clientX - getCanvasWH().x) * ratio;
		let lineY = (e.clientY - getCanvasWH().y) * ratio;
		// 斜线与X轴的角度。这里用弧度，下面的sin和cos也都用弧度。要么都用角度也可以
		let lineangle = Math.atan2(lineY - moveY, lineX - moveX);
		let angle = lineangle;
		let x1, y1, x2, y2, x3, y3;
		let arrowSize = arrowConfig.size * ratio;
		// 让箭头更尖
		let arrowSizeHalf = arrowSize / 2;
		// x1 = lineX + arrowSize * Math.sin(angle);
		// y1 = lineY - arrowSize * Math.cos(angle);
		x1 = lineX + arrowSizeHalf * Math.sin(angle);
		y1 = lineY - arrowSizeHalf * Math.cos(angle);

		x2 = lineX + arrowSize * Math.cos(angle);
		y2 = lineY + arrowSize * Math.sin(angle);

		// x3 = lineX - arrowSize * Math.sin(angle);
		// y3 = lineY + arrowSize * Math.cos(angle);
		x3 = lineX - arrowSizeHalf * Math.sin(angle);
		y3 = lineY + arrowSizeHalf * Math.cos(angle);

		canvasDomCtx.beginPath();
		canvasDomCtx.moveTo(lineX, lineY);
		canvasDomCtx.lineTo(x1, y1);
		canvasDomCtx.lineTo(x2, y2);
		canvasDomCtx.lineTo(x3, y3);
		canvasDomCtx.lineTo(lineX, lineY);
		canvasDomCtx.fill();
		canvasDomCtx.stroke();
	}
}
// arrowMouseupFun
const arrowMouseupFun = e => {
	e.stopPropagation();
	e.preventDefault();
	arrowConfig.canDrag = false;
	saveCanvas();
}

const arrow = $('arrow');
arrow.addEventListener('click', e => {
	removeAllListener();
	removeActiveClass();

	sizeColorChange('arrow');

	pointBox.style.cursor = 'crosshair';
	arrow.classList.add('arrow-active');

	pointBox.addEventListener('mousedown', arrowMousedownFun, false);
	pointBox.addEventListener('mousemove', arrowMousemoveFun, false);
	pointBox.addEventListener('mouseup', arrowMouseupFun, false);
}, false);



// 涂鸦
let graffitiConfig = {
	canDrag: false,
}
// graffitiMousedownFun
const graffitiMousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	canvasDomCtx.beginPath();
	canvasDomCtx.moveTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio);

	graffitiConfig.canDrag = true;
}
// graffitiMousemoveFun
const graffitiMousemoveFun = e => {
	e.stopPropagation();
	e.preventDefault();

	if (graffitiConfig.canDrag) {
		canvasDomCtx.lineTo((e.clientX - getCanvasWH().x) * ratio, (e.clientY - getCanvasWH().y) * ratio);
		canvasDomCtx.stroke();
	}
}
// graffitiMouseupFun
const graffitiMouseupFun = e => {
	e.stopPropagation();
	e.preventDefault();
	graffitiConfig.canDrag = false;
	saveCanvas();
}

const graffiti = $('graffiti');
graffiti.addEventListener('click', e => {
	removeAllListener();
	removeActiveClass();

	sizeColorChange('graffiti');

	pointBox.style.cursor = 'crosshair';
	graffiti.classList.add('graffiti-active');

	pointBox.addEventListener('mousedown', graffitiMousedownFun, false);
	pointBox.addEventListener('mousemove', graffitiMousemoveFun, false);
	pointBox.addEventListener('mouseup', graffitiMouseupFun, false);
}, false);



// 文字
let textConfig = {
	dom: '',
	originX: 0,
	originY: 0,
	canDrag: false,
}
// textMousedownFun
const textMousedownFun = e => {
	e.stopPropagation();
	e.preventDefault();

	// 将之前的文字画入，并删除之前的dom
	if (textConfig.dom) {
		saveFocusText();
	}

	// 创建输入框
	textConfig.dom = document.createElement('div');
	textConfig.dom.setAttribute('contenteditable', 'plaintext-only');
	setTimeout(() => {
		textConfig.dom.focus();
		// 获得焦点后，将撤回按钮设为可点击
		$('undo').classList.remove('undo-disabled');
	});

	textConfig.dom.style.cssText += 'position:fixed;z-index:50;padding:4px 8px;line-height: 1;border:1px solid #333;min-width:20px;resize: none;outline: none;font-size: ' + toolConfigObj.text.fontSize + 'px;font-family:"微软雅黑";color:' + toolConfigObj.text.fillStyle + ';left:' + e.clientX + 'px;top:' + e.clientY + 'px;';
	document.body.appendChild(textConfig.dom);

	// padding+border
	let pt = parseFloat(textConfig.dom.style.paddingTop) + parseFloat(textConfig.dom.style.borderWidth);
	let pl = parseFloat(textConfig.dom.style.paddingLeft) + parseFloat(textConfig.dom.style.borderWidth);
	textConfig.originX = (e.clientX - getCanvasWH().x + pl) * ratio;
	textConfig.originY = (e.clientY - getCanvasWH().y + pt) * ratio;

	// textConfig.canDrag = true;
}
// textMousemoveFun
const textMousemoveFun = e => {
	// e.stopPropagation();
	// e.preventDefault();

	// if (textConfig.canDrag) {

	// }
}
// textMouseupFun
const textMouseupFun = e => {
	// e.stopPropagation();
	// e.preventDefault();
	// textConfig.canDrag = false;
	// saveCanvas();
}

const text = $('text');
text.addEventListener('click', e => {
	removeAllListener();
	removeActiveClass();

	canvasDomCtx.textBaseline = "top";
	sizeColorChange('text');

	pointBox.style.cursor = 'text';
	text.classList.add('text-active');

	pointBox.addEventListener('mousedown', textMousedownFun, false);
	pointBox.addEventListener('mousemove', textMousemoveFun, false);
	pointBox.addEventListener('mouseup', textMouseupFun, false);
}, false);



// 撤销
// 这里之所以不用getImageData和putImageData，是因为他们的效率比较低，参考：https://stackoverflow.com/questions/3952856/why-is-putimagedata-so-slow
const undo = $('undo');
const history = $('history');
undo.addEventListener('click', e => {
	// 将没失去焦点的文本也画入画布
	if (textConfig.dom) {
		saveFocusText();
	}

	// 只有截图（没有任何编辑）时，disable撤回按钮
	if (undo.classList.contains('undo-disabled')) {
		return false;
	} else {
		// 删除最后一步
		global.historyArr.pop();
		// 获取倒数第二步，因为前面已经删除了最后一步，所以这里取length - 1
		let src = global.historyArr[global.historyArr.length - 1];
		history.setAttribute('src', src);
		history.onload = function() {
			canvasDomCtx.drawImage(history, 0, 0);
			localStorage.cutImgUrl = canvasDom.toDataURL();
		};


		if (global.historyArr.length == 1) {
			undo.classList.add('undo-disabled');
		}
	}
})



// 和主进程通讯，截图完以后的操作
function cutFinished(type) {
	rect.classList.remove('rect-active');
	ipcRenderer.send('window-edit', type);
}

// 下载、退出、拷贝
const download = $('download');
const exit = $('exit');
const copy = $('copy');
download.addEventListener('click', e => {
	cutFinished('hide');

	let url = canvasDom.toDataURL();

	remote.dialog.showSaveDialog({
		defaultPath: 'Capture',
		filters: [{
			name: 'Images',
			extensions: ['png', 'jpg', 'gif'],
		}],
	}).then(result => {
		let path = result.filePath;
		// 点击保存按钮
		if (path) {
			fs.writeFile(path, new Buffer(url.replace('data:image/png;base64,', ''), 'base64'), () => {
				cutFinished('quit');
				window && window.close();
			});
		}
		// 点击取消按钮 
		else {
			cutFinished('quit');
			window && window.close();
		}
	}).catch(err => {
		remote.dialog.showErrorBox('错误', `保存截图错误，详情为${err}`);
		console.error(`保存截图错误，详情为${err}`);
	});
}, false);

// 退出
exit.addEventListener('click', e => {
	cutFinished('quit');
}, false);

// 将截图拷贝到剪切板并将图片插入到会话框
function copyImgToClipboard() {
	// 修复：当文本还没失去焦点时，就直接保存图片，导致最后的文本没有画入画布
	if (textConfig.dom) {
		saveFocusText();
	}

	// let url = canvasDom.toDataURL();

	// 这里取localStorage.cutImgUrl，不是canvasDom.toDataURL()，主要是避免在一个屏幕截图，在另一个屏幕双击拷贝到剪切板中，截图为空白的bug。
	// bug的原因：多个屏幕的document为相互独立的（因为主进程中用的map，每个window都载入页面），在没有截图的屏幕双击拷贝的是当前屏幕的document的canvas，而不是截图的屏幕的document的canvas
	let url = localStorage.cutImgUrl || '';

	// linux系统，不能在render进程调用clipboard、nativeImage，必须要在主进程中调用
	if (islinux) {
		ipcRenderer.send('linux-clipboard', url);
	} else {
		clipboard.writeImage(nativeImage.createFromDataURL(url));
	}

	// 防止截图不截取任何区域，直接双击拷贝，拷贝的是上次截的图
	if (url) {
		ipcRenderer.send('insert-canvas');
	}

	cutFinished('quit');
	// window && window.close();
}
copy.addEventListener('click', e => {
	copyImgToClipboard();
}, false);
document.addEventListener('dblclick', e => {
	copyImgToClipboard();
}, false);