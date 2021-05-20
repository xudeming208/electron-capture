// 原理：
// 1、普通模式下：先利用transparent创建透明的、全屏的、置顶的窗口，加载页面，页面中利用navigator.mediaDevices.getUserMedia获取整个屏幕截图，然后在屏幕截图上再canvas；
// 2、因为Windows的基本主题和高对比度主题不支持transparent，处理方式为：先利用opacity创建完全透明的窗口，
// 再截取整个屏幕，然后再将窗口调至不透明，然后再canvas；
// 提示：
// 1、普通模式下也可以利用第2种方法，但是截取整个屏幕中间会闪一下（因为先加载不透明的窗口，会显示黑色，然后窗口再加载半透明的图片），效果不好，所以没采用；
// 2、基本主题和高对比度主题下，如果不按照第2种方法，截取的整个屏幕会是透明的，导致canvas后的结果也是透明的；

// 问题：
// 1. 截图延迟
//     - 由于截图目前有一定时间的延迟，所以对截图技术进行了一天左右时间的调研。截图目前采用的技术是navigator.mediaDevices.getUserMedia
//     - 因为有一定时间的延迟，所以我尝试了其他的一些方案，但是都不理想，延迟和现有技术差别不大，如需改进，可能要尝试客户端开发等技术：
//         1. 利用先创ctron的desktopCapturer.getSources
//         3. 利用electron的capturePage，有bug
//         4. Mac利建截图窗口，再隐藏窗口，而不是每次截图都新建窗口
//         2. Mac利用原生命令行screencapture，Windows和Linux有相应的程序包。Mac截图可以利用原生的快捷键command+shift+4，截取的图片在桌面上
// 2. Linux只支持单屏幕截图。由于Chrome内核的原因，Linux系统无法区分多个屏幕，它所有的屏幕ID都是0:0，不像windows和Mac。参考：https://github.com/electron/electron/issues/21321
// 3. 高版本electron获取的是黑屏的问题，参考https://github.com/electron/electron/issues/21063


// 截图
const path = require('path');

const {
    BrowserWindow,
    ipcMain,
    globalShortcut,
    systemPreferences,
    clipboard,
    nativeImage,
    dialog
} = require('electron');
const isDev = process.env.NODE_ENV === 'development';

let mainWindows = [];
let iswin32 = process.platform == 'win32';
let islinux = process.platform == 'linux';
global.isAero = false;

const winURL = `file://${path.resolve(__dirname, '../renderer/capture/index.html')}`;

// 截图时隐藏IM窗口
let isCutHideWindows = false;

// 截图快捷键
let cutKey = 'Alt + S';
if (iswin32) {
    // 因为Windows的基本主题和高对比度主题对transparent: true的兼容问题，这里区分Windows系统的主题，根据不同的主题设置不同的方案
    global.isAero = systemPreferences.isAeroGlassEnabled();

    cutKey = 'Alt + S';
}
// 退出快捷键
let quitKey = 'Esc';

// 创建窗口
function createWindow() {
    // 获取屏幕数
    let displays = require('electron').screen.getAllDisplays();

    // 由于Chrome内核的原因，Linux系统无法区分多个屏幕，它所有的屏幕ID都是0:0，不像windows和Mac
    // 所以这里禁止2个屏幕截屏
    if (islinux && displays.length > 1) {
        dialog.showMessageBox({
            type: 'none',
            message: '由于Chromium的bug，Linux系统只允许一个屏幕的截图',
            title: '提示',
            buttons: ['确定']
        }).then(() => {
            cutFun();
            IMwindow.webContents.send('has-click-cut', false);
            IMwindow.show();
        });
        return;
    }

    mainWindows = displays.map(display => {
        let winOption = {
            fullscreen: iswin32 || undefined,
            width: display.bounds.width,
            height: display.bounds.height,
            x: display.bounds.x,
            y: display.bounds.y,
            frame: false,
            transparent: true,
            movable: false,
            resizable: false,
            hasShadow: false,
            enableLargerThanScreen: true,
            webPreferences: {
                // 允许打开调试窗口
                devTools: isDev,
                // 允许html中运行nodejs
                nodeIntegration: true
            }
        }

        // 对Windows的基本主题和高对比度主题单独处理，因为它不支持transparent
        if (iswin32 && !global.isAero) {
            winOption.opacity = 0.0;
        }

        if (islinux) {
            delete winOption.resizable;
        }

        let mainWindow = new BrowserWindow(winOption);

        // 打开开发者工具
        isDev && mainWindow.webContents.openDevTools();

        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        // mainWindow.setVisibleOnAllWorkspaces(true);
        // mainWindow.setFullScreenable(false);


        // win10系统需要这样设置全屏，不能通过fullscreen参数
        // if (iswin32) {
        //     mainWindow.setFullScreen(true);
        // }

        mainWindow.setSkipTaskbar(true);

        mainWindow.loadURL(winURL);

        return mainWindow;
    });
}


// 截图快捷键
function cutFun() {
    globalShortcut.register(cutKey, () => {
        // IM窗口为全屏化时，切图时会先缩小IM窗口，不会隐藏窗口，不管是否设置为“截图时隐藏窗口与否”
        if (IMwindow.isFullScreen()) {
            IMwindow.setFullScreen(false);
        }
        // 截图时隐藏IM窗口
        if (isCutHideWindows) {
            IMwindow.hide();
        }

        createWindow();

        // 注销截图快捷键
        globalShortcut.unregister(cutKey);
        quitCutFun();
    });
}

// 退出截图快捷键
function quitCutFun() {
    globalShortcut.register(quitKey, () => {
        windowEdit('quit');
    });
}


// 窗口编辑
function windowEdit(type) {
    if (mainWindows) {
        mainWindows.forEach(win => {
            if (win) {
                win.webContents.send('capture-finish');

                // 取消截图（按ESC键）或者截图完成后（如保存，取消，保存至剪切板）恢复聊天窗口
                if (isCutHideWindows) {
                    IMwindow.show();
                }

                if (type == 'quit') {
                    win.destroy();
                } else if (type == 'hide') {
                    win.hide();
                }
            }

            // 防止快速点击截图按钮
            IMwindow.webContents.send('has-click-cut', false);
            
        });
        mainWindows = [];
    }

    // 注销退出截图快捷键
    globalShortcut.unregister(quitKey);
    cutFun();
}



// cutWindow
function cutWindow(IMwindow) {
    global.IMwindow = IMwindow;

    cutFun();
    quitCutFun();

    // linux全屏
    ipcMain.on('linux-fullscreen', (event, type) => {
        mainWindows.forEach(win => {
            win.setFullScreen(true);
        });
    });


    // 和渲染进程通讯
    ipcMain.on('window-edit', (event, type) => {
        windowEdit(type);
    });

    // 点击截图按钮截图
    ipcMain.on('cut-screen', (event, type) => {
        // IM窗口为全屏化时，切图时会先缩小IM窗口，不会隐藏窗口，不管是否设置为“截图时隐藏窗口与否”
        if (IMwindow.isFullScreen()) {
            IMwindow.setFullScreen(false);
        }

        createWindow();
        // 激活退出快捷键
        quitCutFun();
    });


    // 截图时是否隐藏当前窗口
    ipcMain.on('is-hide-windows', (event, isHide) => {
        isCutHideWindows = isHide;
    });


    // 设置截图快捷键
    ipcMain.on('setCaptureKey', (event, key) => {
        try {
            globalShortcut.unregister(cutKey);
            if (!key) {
                return;
            }
            cutKey = key;
            cutFun();
        } catch (error) {
            console.error(error);
        }
    });

    // linux系统，不能在render进程调用clipboard、nativeImage，必须要在主进程中调用
    if (islinux) {
        ipcMain.on('linux-clipboard', (event, url) => {
            clipboard.writeImage(nativeImage.createFromDataURL(url));
        });
    }
}

module.exports = cutWindow;