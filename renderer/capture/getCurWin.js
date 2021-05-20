const {
	desktopCapturer,
	remote
} = require('electron');

const iswin32 = process.platform == 'win32';
const islinux = process.platform == 'linux';

// 获取所有窗口
const allWindows = remote.screen.getAllDisplays();

// get currentWindow
const currentWindow = remote.getCurrentWindow();
const bounds = currentWindow.getBounds() || {};

// 宽高
let currentWidth = bounds.width;
let currentHeight = bounds.height;

if (islinux) {
	currentWidth = bounds.width + bounds.x;
	currentHeight = bounds.height + bounds.y;
}


// 屏幕id是根据此获取的
// desktopCapturer.getSources({
// 	types: ['screen'],
// 	thumbnailSize: {
// 		width: 0,
// 		height: 0
// 	}
// }).then(source => {
// 	console.log(9, source)
// }).catch(error => {
// 	console.error(error);
// })


function $(id) {
	return document.getElementById(id);
}

// 获取屏幕id。可以根据desktopCapturer.getSources查看各个屏幕的ID
function getCurrentScreen() {
	let {
		x,
		y
	} = bounds;
	if (iswin32) {
		if (x == 0 && y == 0) {
			return {
				id: '0:0'
			};
		} else {
			return {
				id: '1:0'
			};
		}
	} else if (islinux) {
		// 由于Chrome内核的原因，Linux系统无法区分多个屏幕，它所有的屏幕ID都是0:0，不像windows和Mac
		// 参考：https://github.com/electron/electron/issues/21321
		return {
			id: '0:0'
		};
	} else {
		let arr = allWindows.filter(item => item.bounds.x == x && item.bounds.y == y);
		let obj = arr[0] || {};
		return {
			id: obj.id + ':0'
		}
	}
}

exports.$ = $;
exports.chromeMediaSourceId = getCurrentScreen().id;
exports.currentWidth = currentWidth;
exports.currentHeight = currentHeight;