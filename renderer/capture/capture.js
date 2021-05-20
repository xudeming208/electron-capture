const {
	ipcRenderer,
	remote
} = require('electron');

const {
	$,
	chromeMediaSourceId,
	currentWidth,
	currentHeight
} = require('./getCurWin');

const {
	cut
} = require('./render');

const imgDom = $('screenImg');
const mask = $('mask');

const iswin32 = process.platform == 'win32';
const islinux = process.platform == 'linux';

// retina显示屏和普通显示屏
const ratio = window.devicePixelRatio || 1;

const currentWindow = remote.getCurrentWindow();
const isAero = remote.getGlobal('isAero');

// handleError
function handleError(error) {
	console.error(`${error.errmsg || error.toString()}`);
}

// handleStream
function handleStream(stream) {
	let video = document.createElement('video');

	video.addEventListener('loadedmetadata', () => {
		// video.addEventListener('canplay', () => {

		// 必须要加play => https://github.com/electron/electron/issues/21063
		video.play();
		// video.style.width = currentWidth * ratio + 'px';
		// video.style.height = currentHeight * ratio + 'px';
		// video.style.cssText += 'width: ' + (currentWidth * ratio) + 'px; height: ' + (currentHeight * ratio) + 'px';

		// 创建canvas
		let canvas = document.createElement('canvas');
		canvas.width = currentWidth * ratio;
		canvas.height = currentHeight * ratio;
		let ctx = canvas.getContext('2d');
		ctx.drawImage(video, 0, 0, currentWidth * ratio, currentHeight * ratio);
		video.remove();

		// 操作img
		imgDom.style.cssText += 'width: ' + currentWidth + 'px; height: ' + currentHeight + 'px;display:block;';
		// imgDom.width = currentWidth;
		// imgDom.height = currentHeight;
		// imgDom.src = canvas.toDataURL('image/jpeg', 1.0);
		imgDom.src = canvas.toDataURL();
		mask.style.cssText += 'opacity: 1';

		// 对Windows的基本主题和高对比度主题单独处理，因为它不支持transparent
		if (iswin32 && !isAero) {
			currentWindow.setOpacity(1.0);
		}

		// linux
		if (islinux) {
			ipcRenderer.send('linux-fullscreen');
		}

		// 触发截图
		cut();

	}, false);

	video.srcObject = stream;
	video.style.visibility = 'hidden';
	document.body.appendChild(video);
}


// 创建蒙版窗口
function getUserMedia(id) {
	navigator.mediaDevices.getUserMedia({
		audio: false,
		video: {
			mandatory: {
				chromeMediaSource: 'desktop',
				chromeMediaSourceId: id,
				minWidth: currentWidth,
				maxWidth: currentWidth * ratio,
				minHeight: currentHeight,
				maxHeight: currentHeight * ratio
			}
		}
	}).then(stream => {
		handleStream(stream);
	}).catch(error => {
		handleError(error);
	});
}


// 避免偶尔的截取的全屏图片带有mask透明，不是清晰的全屏图
mask.style.cssText += 'opacity:0';

// 防止截图不截取任何区域，直接双击拷贝，拷贝的是上次截的图
localStorage.cutImgUrl = '';

// if (iswin32) {
// 	mask.style.cssText += 'opacity:0';
// 	// setTimeout(() => {
// 	getUserMedia(`screen:${chromeMediaSourceId}`);
// 	// }, 0);
// } else {
	getUserMedia(`screen:${chromeMediaSourceId}`);
// }