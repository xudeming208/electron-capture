// electron插件：https://github.com/sindresorhus/awesome-electron

const path = require('path');

// 日志
const log = require('fe-logs');
log.setMode('error');
log.setName('.electron-capture-log.txt');

const {
    app,
    Menu,
    shell,
    ipcMain,
    Tray,
    globalShortcut,
    BrowserWindow
} = require('electron');

// 截图窗口
const captureWin = require('./capture');

// 是否为开发环境
const isDev = process.env.NODE_ENV === 'development';
const iswin32 = process.platform == 'win32';
const islinux = process.platform == 'linux';
const ismac = process.platform == 'darwin';
const winURL = `file://${path.resolve(__dirname, '../renderer/index.html')}`;

let win = null;
let appTray = null;
let willQuitApp = false;

// 程序电脑开机自动启动。参考：https://github.com/Teamwork/node-auto-launch
let AutoLaunch = require('auto-launch');
// 开发时，应用名称叫electron(而不是叫截图工具)，所有不允许将electron设置为开机自动启动
if (!isDev) {
    let autolaunchConfig = {
        name: '截图工具'
    }

    // linux下需要指定path。参考https://github.com/Teamwork/node-auto-launch/issues/89
    if (islinux) {
        autolaunchConfig.path = process.env.APPIMAGE;
    }

    let minecraftAutoLauncher = new AutoLaunch(autolaunchConfig);
    ipcMain.on('launch', (event, isLanch) => {
        if (isLanch) {
            minecraftAutoLauncher.enable().catch(error => {
                console.error(error);
            });
        } else {
            minecraftAutoLauncher.disable().catch(error => {
                console.error(error);
            });
        }
    });
}

let showKey = 'CommandOrControl+E';

// 退出程序
function quitApp() {
    app.quit();
    try {
        globalShortcut.unregister('CommandOrControl+W');
        globalShortcut.unregister(showKey);
        globalShortcut.unregister('CommandOrControl+Q');
    } catch (error) {
        console.error(error);
    }
}

// 设置菜单
let menuList = [{
    label: "Capture",
    submenu: [{
        label: "About",
        role: "about",
    }, {
        type: "separator"
    }, {
        label: "Quit",
        role: "quit",
    }]
}, {
    label: "Edit",
    submenu: [{
        label: 'Undo',
        role: 'undo'
    }, {
        label: 'Redo',
        role: 'redo'
    }, {
        type: 'separator'
    }, {
        label: 'Cut',
        role: 'cut'
    }, {
        label: 'Copy',
        role: 'copy'
    }, {
        label: 'Paste',
        role: 'paste'
    }, {
        label: 'Selectall',
        role: 'selectall'
    }]
}, {
    label: 'View',
    submenu: [{
        label: 'Resetzoom',
        role: 'resetZoom'
    }, {
        label: 'Zoomin',
        role: 'zoomIn'
    }, {
        label: 'Zoomout',
        role: 'zoomOut'
    }]
}, {
    label: 'Window',
    role: "window",
    submenu: [{
        label: "Hide",
        role: "hide",
    }, {
        label: "Minimize",
        role: "minimize",
    }, {
        label: "Close",
        role: 'close'
    }, {
        type: "separator"
    }, {
        label: "Quit",
        role: "quit",
    }]
}, {
    label: 'Help',
    role: 'help',
    submenu: [{
        type: "separator"
    }, {
        label: 'Homepage',
        click() {
            shell.openExternal('https://github.com/xudeming208/electron-capture');
        }
    }]
}];

// 设置windows任务栏图标
function setTray() {
    if (iswin32) {
        appTray = new Tray(path.join(__dirname, '../static/icons/icon.ico'));
        const contextMenu = Menu.buildFromTemplate([{
            label: '关于',
            click: event => {
                shell.openExternal('https://github.com/xudeming208/electron-capture');
            }
        }, {
            label: '意见反馈',
            click: event => {
                shell.openExternal('https://github.com/xudeming208/electron-capture/issues');
            }
        }, {
            label: '退出程序',
            click: event => {
                quitApp();
            }
        }]);
        appTray.setContextMenu(contextMenu);
        appTray.on("click", () => {
            win.show();
        });
    }
}

// 创建浏览器窗口。
function createWindow() {
    let windowOption = {
        width: 500,
        minWidth: 500,
        height: 300,
        minHeight: 300,
        useContentSize: true,
        center: true,
        // 默认窗口标题 默认为"Electron"。 如果由loadURL()加载的HTML文件中含有标签<title>，此属性将被忽略。
        title: '截图工具',
        webPreferences: {
            // 允许打开调试窗口
            devTools: isDev,
            // 允许html中运行nodejs
            nodeIntegration: true
        }
    }

    // 设置Linux appimage应用图标。参考https://github.com/AppImage/AppImageKit/wiki/Bundling-Electron-apps
    if (islinux) {
        windowOption.icon = path.join(__dirname, '../static/icons/512x512.png');
    }

    win = new BrowserWindow(windowOption)

    // 打开开发者工具
    isDev && win.webContents.openDevTools();

    // 当 window 被关闭时，这个事件会被触发。
    win.on('close', event => {
        // 点击关闭按钮只是隐藏应用，但是Cmd + Q或者右键退出按钮则退出应用
        if (willQuitApp) {
            quitApp();
            return;
        }
        event.preventDefault();
        win.hide();
    });

    // 加载index.html文件
    win.loadURL(winURL);

    // 设置菜单
    if (ismac) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuList));
    } else {
        Menu.setApplicationMenu(null);
    }

    setTray();

    // 设置快捷键。mac本来就有这2种快捷键，无需设置
    if (!ismac) {
        globalShortcut.register('CommandOrControl+W', () => {
            win.hide();
        });
        globalShortcut.register('CommandOrControl+Q', () => {
            quitApp();
        });
    }

    try {
        globalShortcut.register(showKey, () => {
            win.show();
        });
    } catch (error) {
        console.error(error);
    }
}

// 在应用程序开始关闭窗口之前触发
app.on('before-quit', () => {
    willQuitApp = true;
})

// 当应用被激活时发出
app.on('activate', () => {
    win.show();
})

// 当全部窗口关闭时退出。
// app.on('window-all-closed', () => {
//     // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
//     // 否则绝大部分应用及其菜单栏会保持激活。
//     if (process.platform !== 'darwin') {
//         app.quit();
//     }
// })

// 隐藏窗口
ipcMain.on('windows-hide', event => {
    win.hide();
});
// 截图完成弹出提示框
ipcMain.on('insert-canvas', function(event) {
    win.show();
    win.webContents.send('popup-tips');
});
// 自定义快捷键
ipcMain.on('setShowKey', (event, key) => {
    try {
        globalShortcut.unregister(showKey);
        if (!key) {
            return;
        }
        showKey = key;
        globalShortcut.register(showKey, () => {
            win.show();
        });
    } catch (error) {
        console.error(error);
    }
});

// 开发时，允许多窗口
if (isDev) {
    app.on('ready', () => {
        createWindow();
        captureWin(win);
    });
} else {
    // 正式版避免多个实例，避免运行多少次就有多少个窗口（Windows系统）
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        quitApp();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // 当运行第二个实例时,将会聚焦到win这个窗口
            if (win) {
                if (win.isMinimized()) {
                    win.restore();
                }
                win.show();
            }
        })

        // ready
        // 创建浏览器窗口时
        // 部分 API 在 ready 事件触发后才能使用。
        app.on('ready', () => {
            createWindow();
            captureWin(win);
        });
    }
}